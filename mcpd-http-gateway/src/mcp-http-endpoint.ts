#!/usr/bin/env node

/**
 * MCP-over-HTTP Endpoint
 * 
 * This provides a Composio-style HTTP endpoint that speaks the MCP protocol
 * directly over HTTP, allowing tools like Cursor and Claude to connect directly.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
// import { v4 as uuidv4 } from 'uuid';  // For future use

dotenv.config();

const PORT = process.env.MCP_PORT || 3001;
const MCPD_URL = process.env.MCPD_URL || 'http://localhost:8090';

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class MCPHTTPEndpoint {
  private app: express.Application;
  private mcpdUrl: string;
  // private serverCache: Map<string, any> = new Map();  // For future caching

  constructor() {
    this.app = express();
    this.mcpdUrl = MCPD_URL;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.text({ type: 'application/json', limit: '50mb' }));
  }

  private setupRoutes() {
    // Main MCP endpoint - handles all MCP protocol messages
    this.app.post('/mcp', async (req: Request, res: Response) => {
      try {
        const request = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const response = await this.handleMCPRequest(request);
        res.json(response);
      } catch (error: any) {
        res.json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // Server-specific endpoints (like Composio's pattern)
    this.app.post('/partner/:partner/:server/mcp', async (req: Request, res: Response) => {
      try {
        const { server } = req.params;
        const request = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        // Add server context to the request
        if (request.method === 'tools/list' || request.method === 'tools/call') {
          request.params = { ...request.params, server };
        }
        
        const response = await this.handleMCPRequest(request, server);
        res.json(response);
      } catch (error: any) {
        res.json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', mcp: true });
    });
  }

  private async handleMCPRequest(request: MCPRequest, targetServer?: string): Promise<MCPResponse> {
    const { method, params, id } = request;

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '1.0.0',
              capabilities: {
                tools: {},
                resources: {},
                prompts: {}
              },
              serverInfo: {
                name: targetServer ? `mcpd-${targetServer}` : 'mcpd-gateway',
                version: '1.0.0'
              }
            }
          };

        case 'initialized':
          return { jsonrpc: '2.0', id, result: {} };

        case 'tools/list':
          const tools = await this.listTools(targetServer);
          return {
            jsonrpc: '2.0',
            id,
            result: { tools }
          };

        case 'tools/call':
          const result = await this.callTool(params.name, params.arguments, targetServer);
          return {
            jsonrpc: '2.0',
            id,
            result
          };

        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id,
            result: { resources: [] }
          };

        case 'prompts/list':
          return {
            jsonrpc: '2.0',
            id,
            result: { prompts: [] }
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          };
      }
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message
        }
      };
    }
  }

  private async listTools(targetServer?: string): Promise<any[]> {
    try {
      if (targetServer) {
        // Get tools for specific server
        const response = await axios.get(`${this.mcpdUrl}/api/v1/servers/${targetServer}/tools`);
        return (response.data.tools || []).map((tool: any) => ({
          name: tool.name,
          description: tool.description || `${tool.name} from ${targetServer}`,
          inputSchema: tool.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          }
        }));
      } else {
        // Get tools from all servers
        const serversResponse = await axios.get(`${this.mcpdUrl}/api/v1/servers`);
        const servers = serversResponse.data.servers || [];
        
        const allTools: any[] = [];
        for (const server of servers) {
          try {
            const toolsResponse = await axios.get(`${this.mcpdUrl}/api/v1/servers/${server.name}/tools`);
            const tools = toolsResponse.data.tools || [];
            
            tools.forEach((tool: any) => {
              allTools.push({
                name: `${server.name}__${tool.name}`,
                description: tool.description || `${tool.name} from ${server.name}`,
                inputSchema: tool.inputSchema || {
                  type: 'object',
                  properties: {},
                  required: []
                }
              });
            });
          } catch (error) {
            console.error(`Failed to fetch tools for ${server.name}:`, error);
          }
        }
        
        return allTools;
      }
    } catch (error: any) {
      console.error('Failed to list tools:', error);
      return [];
    }
  }

  private async callTool(toolName: string, args: any, targetServer?: string): Promise<any> {
    try {
      let server: string;
      let tool: string;
      
      if (targetServer) {
        // Server specified in URL
        server = targetServer;
        tool = toolName;
      } else {
        // Parse namespaced tool name
        const parts = toolName.split('__');
        if (parts.length !== 2) {
          throw new Error(`Invalid tool name format: ${toolName}`);
        }
        server = parts[0];
        tool = parts[1];
      }
      
      const response = await axios.post(
        `${this.mcpdUrl}/api/v1/servers/${server}/tools/${tool}/call`,
        { arguments: args || {} }
      );
      
      // Format response in MCP style
      if (typeof response.data === 'string') {
        return {
          content: [
            { type: 'text', text: response.data }
          ]
        };
      } else if (response.data.content) {
        return response.data;
      } else {
        return {
          content: [
            { type: 'text', text: JSON.stringify(response.data, null, 2) }
          ]
        };
      }
    } catch (error: any) {
      throw new Error(`Failed to call tool: ${error.message}`);
    }
  }

  async start() {
    // Test MCPD connection
    try {
      await axios.get(`${this.mcpdUrl}/api/v1/health`);
      console.log(`✓ Connected to MCPD at ${this.mcpdUrl}`);
    } catch (error) {
      console.error(`✗ Could not connect to MCPD at ${this.mcpdUrl}`);
    }
    
    this.app.listen(PORT, () => {
      console.log(`\n🚀 MCP-over-HTTP Endpoint running on http://localhost:${PORT}`);
      console.log(`\n📡 MCP Protocol Endpoints:`);
      console.log(`   All servers: http://localhost:${PORT}/mcp`);
      console.log(`   Specific server: http://localhost:${PORT}/partner/mcpd/{server}/mcp`);
      console.log(`\nExample Cursor/Claude configuration:`);
      console.log(`   URL: http://localhost:${PORT}/mcp`);
      console.log(`\nExample for specific server:`);
      console.log(`   URL: http://localhost:${PORT}/partner/mcpd/filesystem/mcp`);
    });
  }
}

// Start the server
const endpoint = new MCPHTTPEndpoint();
endpoint.start().catch((error) => {
  console.error('Failed to start MCP endpoint:', error);
  process.exit(1);
});