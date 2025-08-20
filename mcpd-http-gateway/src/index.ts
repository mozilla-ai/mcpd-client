#!/usr/bin/env node

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import http from 'http';
import axios from 'axios';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Configuration
const PORT = process.env.PORT || 3000;
const MCPD_URL = process.env.MCPD_URL || 'http://localhost:8090';
const API_KEY = process.env.API_KEY || 'default-dev-key';
const ENABLE_CORS = process.env.ENABLE_CORS !== 'false';
// const SSL_CERT = process.env.SSL_CERT;  // TODO: Implement HTTPS support
// const SSL_KEY = process.env.SSL_KEY;

// Types

interface AuthRequest extends Request {
  user?: {
    id: string;
    apiKey: string;
  };
}

class MCPDHTTPGateway {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private mcpdUrl: string;
  private apiKeys: Set<string>;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.mcpdUrl = MCPD_URL;
    this.apiKeys = new Set([API_KEY]);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware() {
    // Security
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    
    // CORS
    if (ENABLE_CORS) {
      this.app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-MCP-Server', 'X-MCP-Tool']
      }));
    }
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: 'Too many requests, please try again later'
    });
    this.app.use('/api/', limiter);
    
    // Logging
    this.app.use(morgan('combined'));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  // Authentication middleware
  private authenticate = (req: AuthRequest, res: Response, next: NextFunction): Response | void => {
    const apiKey = req.headers['x-api-key'] || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.apiKey;
    
    if (!apiKey || !this.apiKeys.has(apiKey as string)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    req.user = {
      id: uuidv4(),
      apiKey: apiKey as string
    };
    
    next();
  };

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', mcpd: this.mcpdUrl });
    });
    
    // API Documentation
    this.app.get('/api', (_req, res) => {
      res.json({
        version: '1.0.0',
        endpoints: {
          servers: {
            list: 'GET /api/servers',
            get: 'GET /api/servers/:name',
            tools: 'GET /api/servers/:name/tools'
          },
          tools: {
            list: 'GET /api/tools',
            call: 'POST /api/tools/call',
            callDirect: 'POST /api/servers/:server/tools/:tool/call'
          },
          websocket: {
            connect: 'ws://localhost:3000/ws',
            protocol: 'Send JSON messages with {type, server, tool, params}'
          }
        },
        authentication: 'Use X-API-Key header or Authorization: Bearer <key>'
      });
    });
    
    // List all servers
    this.app.get('/api/servers', this.authenticate, async (_req: AuthRequest, res: Response) => {
      try {
        const response = await axios.get(`${this.mcpdUrl}/api/v1/servers`);
        return res.json(response.data);
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    });
    
    // Get specific server
    this.app.get('/api/servers/:name', this.authenticate, async (req: AuthRequest, res: Response): Promise<Response> => {
      try {
        const response = await axios.get(`${this.mcpdUrl}/api/v1/servers`);
        const server = response.data.servers?.find((s: any) => s.name === req.params.name);
        
        if (!server) {
          return res.status(404).json({ error: 'Server not found' });
        }
        
        return res.json(server);
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    });
    
    // Get server tools
    this.app.get('/api/servers/:name/tools', this.authenticate, async (req: AuthRequest, res: Response): Promise<Response> => {
      try {
        const response = await axios.get(`${this.mcpdUrl}/api/v1/servers/${req.params.name}/tools`);
        return res.json(response.data);
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    });
    
    // List all tools (from all servers)
    this.app.get('/api/tools', this.authenticate, async (_req: AuthRequest, res: Response): Promise<Response> => {
      try {
        const serversResponse = await axios.get(`${this.mcpdUrl}/api/v1/servers`);
        const servers = serversResponse.data.servers || [];
        
        const allTools: any[] = [];
        for (const server of servers) {
          try {
            const toolsResponse = await axios.get(`${this.mcpdUrl}/api/v1/servers/${server.name}/tools`);
            const tools = toolsResponse.data.tools || [];
            
            tools.forEach((tool: any) => {
              allTools.push({
                ...tool,
                server: server.name,
                fullName: `${server.name}__${tool.name}`
              });
            });
          } catch (error) {
            console.error(`Failed to fetch tools for ${server.name}:`, error);
          }
        }
        
        return res.json({ tools: allTools });
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    });
    
    // Call a tool (flexible endpoint)
    this.app.post('/api/tools/call', this.authenticate, async (req: AuthRequest, res: Response): Promise<Response> => {
      try {
        const { server, tool, params } = req.body;
        
        if (!server || !tool) {
          return res.status(400).json({ error: 'Server and tool are required' });
        }
        
        const response = await axios.post(
          `${this.mcpdUrl}/api/v1/servers/${server}/tools/${tool}/call`,
          { arguments: params || {} }
        );
        
        return res.json(response.data);
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    });
    
    // Direct tool call endpoint
    this.app.post('/api/servers/:server/tools/:tool/call', this.authenticate, async (req: AuthRequest, res: Response): Promise<Response> => {
      try {
        const { server, tool } = req.params;
        const params = req.body;
        
        const response = await axios.post(
          `${this.mcpdUrl}/api/v1/servers/${server}/tools/${tool}/call`,
          { arguments: params }
        );
        
        return res.json(response.data);
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    });
    
    // MCP-compatible endpoint (for tools that expect MCP protocol over HTTP)
    this.app.post('/api/mcp', this.authenticate, async (req: AuthRequest, res: Response): Promise<Response> => {
      try {
        const { method, params } = req.body;
        const server = req.headers['x-mcp-server'] as string;
        
        if (!server) {
          return res.status(400).json({ error: 'X-MCP-Server header required' });
        }
        
        switch (method) {
          case 'tools/list':
            const toolsResponse = await axios.get(`${this.mcpdUrl}/api/v1/servers/${server}/tools`);
            return res.json({ tools: toolsResponse.data.tools });
            
          case 'tools/call':
            if (!params?.name) {
              return res.status(400).json({ error: 'Tool name required' });
            }
            
            const callResponse = await axios.post(
              `${this.mcpdUrl}/api/v1/servers/${server}/tools/${params.name}/call`,
              { arguments: params.arguments || {} }
            );
            
            return res.json(callResponse.data);
            
          default:
            return res.status(400).json({ error: `Unknown method: ${method}` });
        }
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    });
    
    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected');
      
      // Extract API key from query params or first message
      let authenticated = false;
      const apiKey = new URL(req.url!, `http://localhost`).searchParams.get('apiKey');
      
      if (apiKey && this.apiKeys.has(apiKey)) {
        authenticated = true;
      }
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Handle authentication
          if (!authenticated) {
            if (data.type === 'auth' && data.apiKey && this.apiKeys.has(data.apiKey)) {
              authenticated = true;
              ws.send(JSON.stringify({ type: 'auth', status: 'success' }));
              return;
            } else {
              ws.send(JSON.stringify({ type: 'error', error: 'Unauthorized' }));
              ws.close();
              return;
            }
          }
          
          // Handle requests
          switch (data.type) {
            case 'servers.list':
              const serversResponse = await axios.get(`${this.mcpdUrl}/api/v1/servers`);
              ws.send(JSON.stringify({ 
                type: 'servers.list', 
                data: serversResponse.data 
              }));
              break;
              
            case 'tools.list':
              const toolsResponse = await axios.get(
                `${this.mcpdUrl}/api/v1/servers/${data.server}/tools`
              );
              ws.send(JSON.stringify({ 
                type: 'tools.list', 
                server: data.server,
                data: toolsResponse.data 
              }));
              break;
              
            case 'tools.call':
              const callResponse = await axios.post(
                `${this.mcpdUrl}/api/v1/servers/${data.server}/tools/${data.tool}/call`,
                { arguments: data.params || {} }
              );
              ws.send(JSON.stringify({ 
                type: 'tools.result',
                id: data.id,
                data: callResponse.data 
              }));
              break;
              
            default:
              ws.send(JSON.stringify({ 
                type: 'error', 
                error: `Unknown message type: ${data.type}` 
              }));
          }
        } catch (error: any) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: error.message 
          }));
        }
      });
      
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  async start() {
    // Test MCPD connection
    try {
      await axios.get(`${this.mcpdUrl}/api/v1/health`);
      console.log(`✓ Connected to MCPD at ${this.mcpdUrl}`);
    } catch (error) {
      console.error(`✗ Could not connect to MCPD at ${this.mcpdUrl}`);
      console.error('  Make sure MCPD is running');
    }
    
    this.server.listen(PORT, () => {
      console.log(`\n🚀 MCPD HTTP Gateway running on http://localhost:${PORT}`);
      console.log(`\n📚 API Documentation: http://localhost:${PORT}/api`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`\n🔑 Authentication: Use X-API-Key header with key: ${API_KEY}`);
      
      console.log('\nExample usage:');
      console.log(`  curl http://localhost:${PORT}/api/servers -H "X-API-Key: ${API_KEY}"`);
      console.log(`  curl http://localhost:${PORT}/api/tools -H "X-API-Key: ${API_KEY}"`);
    });
  }
}

// Start the gateway
const gateway = new MCPDHTTPGateway();
gateway.start().catch((error) => {
  console.error('Failed to start gateway:', error);
  process.exit(1);
});