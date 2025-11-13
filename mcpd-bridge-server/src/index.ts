#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  TextContent,
  ImageContent,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
let targetServer: string | undefined;
let useNamespacing = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--server' || args[i] === '-s') {
    targetServer = args[i + 1];
    i++;
  } else if (args[i] === '--no-namespace') {
    useNamespacing = false;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
mcpd Bridge Server - Universal MCP adapter for mcpd

Usage:
  mcpd-bridge-server [options]

Options:
  --server, -s <name>  Proxy only the specified server (individual mode)
  --no-namespace       Disable tool namespacing in individual mode
  --help, -h           Show this help message

Examples:
  # Unified mode - expose all servers with namespaced tools
  mcpd-bridge-server

  # Individual mode - expose only filesystem server
  mcpd-bridge-server --server filesystem

  # Individual mode without namespacing
  mcpd-bridge-server --server github --no-namespace

Environment Variables:
  MCPD_URL      URL of mcpd daemon (default: http://localhost:8090)
  MCPD_API_KEY  Optional API key for mcpd authentication
`);
    process.exit(0);
  }
}

interface McpdServer {
  name: string;
  package: string;
  tools?: string[];
  requiredEnv?: string[];
  requiredArgs?: string[];
}

interface McpdTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

class McpdBridgeServer {
  private server: Server;
  private mcpdUrl: string;
  private apiKey?: string;
  private toolCache: Map<string, McpdTool[]> = new Map();
  private targetServer?: string;
  private useNamespacing: boolean;
  private mode: 'unified' | 'individual';

  constructor(targetServer?: string, useNamespacing: boolean = true) {
    this.mcpdUrl = process.env.MCPD_URL || 'http://localhost:8090';
    this.apiKey = process.env.MCPD_API_KEY;
    this.targetServer = targetServer;
    this.useNamespacing = useNamespacing;
    this.mode = targetServer ? 'individual' : 'unified';
    
    // Set server name based on mode
    const serverName = this.mode === 'individual' 
      ? `mcpd-${targetServer}` 
      : 'mcpd-bridge';
    
    this.server = new Server(
      {
        name: serverName,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async loadConfig() {
    const configPath = path.join(os.homedir(), '.config', 'mcpd', 'config.toml');
    if (fs.existsSync(configPath)) {
      console.error(`Loading mcpd config from ${configPath}`);
      // We'd need a TOML parser here in production
      // For now, we'll rely on environment variables
    }
  }

  private async fetchServers(): Promise<McpdServer[]> {
    try {
      const response = await axios.get(`${this.mcpdUrl}/api/v1/servers`, {
        headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {},
      });
      return response.data.servers || [];
    } catch (error: any) {
      console.error('Failed to fetch servers from mcpd:', error.message);
      return [];
    }
  }

  private async fetchToolsForServer(serverName: string): Promise<McpdTool[]> {
    try {
      const response = await axios.get(`${this.mcpdUrl}/api/v1/servers/${serverName}/tools`, {
        headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {},
      });
      return response.data.tools || [];
    } catch (error: any) {
      console.error(`Failed to fetch tools for server ${serverName}:`, error.message);
      return [];
    }
  }

  private async getAllTools(): Promise<Tool[]> {
    let servers: McpdServer[];
    
    if (this.mode === 'individual' && this.targetServer) {
      // In individual mode, only fetch the target server
      const allServers = await this.fetchServers();
      const server = allServers.find(s => s.name === this.targetServer);
      if (!server) {
        console.error(`Server '${this.targetServer}' not found in mcpd`);
        return [];
      }
      servers = [server];
    } else {
      // In unified mode, fetch all servers
      servers = await this.fetchServers();
    }
    
    const allTools: Tool[] = [];
    
    for (const server of servers) {
      const tools = await this.fetchToolsForServer(server.name);
      this.toolCache.set(server.name, tools);
      
      for (const tool of tools) {
        // Apply namespacing based on mode and settings
        let toolName = tool.name;
        if (this.mode === 'unified') {
          // Always namespace in unified mode
          toolName = `${server.name}__${tool.name}`;
        } else if (this.mode === 'individual' && this.useNamespacing) {
          // Optional namespacing in individual mode
          toolName = `${server.name}__${tool.name}`;
        }
        // else: no namespacing in individual mode when disabled
        
        allTools.push({
          name: toolName,
          description: tool.description || `${tool.name} from ${server.name}`,
          inputSchema: tool.inputSchema || {
            type: 'object',
            properties: {},
          },
        });
      }
    }
    
    return allTools;
  }

  private parseToolName(namespacedName: string): { server: string; tool: string } {
    if (this.mode === 'individual' && !this.useNamespacing && this.targetServer) {
      // In individual mode without namespacing, use the target server
      return { server: this.targetServer, tool: namespacedName };
    }
    
    // Otherwise, parse the namespaced name
    const parts = namespacedName.split('__');
    if (parts.length !== 2) {
      // If not namespaced and we have a target server, use it
      if (this.targetServer) {
        return { server: this.targetServer, tool: namespacedName };
      }
      throw new Error(`Invalid tool name format: ${namespacedName}`);
    }
    return { server: parts[0], tool: parts[1] };
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const modeDesc = this.mode === 'individual' 
        ? `for server '${this.targetServer}'` 
        : 'across all servers';
      console.error(`Fetching tools from mcpd ${modeDesc}...`);
      const tools = await this.getAllTools();
      console.error(`Found ${tools.length} tools`);
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const { server, tool } = this.parseToolName(name);
        
        console.error(`Calling tool ${tool} on server ${server}`);
        
        const response = await axios.post(
          `${this.mcpdUrl}/api/v1/servers/${server}/tools/${tool}/call`,
          {
            arguments: args || {},
          },
          {
            headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {},
          }
        );
        
        const result = response.data;
        
        // Format the response based on the result type
        let content: Array<TextContent | ImageContent>;
        
        if (result.content) {
          // If the result already has content array, use it
          content = result.content;
        } else if (typeof result === 'string') {
          content = [{ type: 'text', text: result }];
        } else {
          content = [{ type: 'text', text: JSON.stringify(result, null, 2) }];
        }
        
        return { content } as CallToolResult;
      } catch (error: any) {
        console.error(`Error calling tool ${name}:`, error.message);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        } as CallToolResult;
      }
    });
  }

  async start() {
    await this.loadConfig();
    
    // Log mode information
    if (this.mode === 'individual') {
      console.error(`Starting in INDIVIDUAL mode for server: ${this.targetServer}`);
      console.error(`Namespacing: ${this.useNamespacing ? 'enabled' : 'disabled'}`);
    } else {
      console.error('Starting in UNIFIED mode (all servers)');
    }
    
    // Test connection to mcpd
    console.error(`Connecting to mcpd at ${this.mcpdUrl}...`);
    try {
      await axios.get(`${this.mcpdUrl}/api/v1/health`, {
        headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {},
      });
      console.error('Successfully connected to mcpd');
      
      // Verify target server exists in individual mode
      if (this.mode === 'individual' && this.targetServer) {
        const servers = await this.fetchServers();
        const serverExists = servers.some(s => s.name === this.targetServer);
        if (!serverExists) {
          console.error(`Error: Server '${this.targetServer}' not found in mcpd`);
          console.error('Available servers:', servers.map(s => s.name).join(', '));
          process.exit(1);
        }
      }
    } catch (error: any) {
      console.error('Warning: Could not connect to mcpd:', error.message);
      console.error('The bridge server will start, but tools may not be available');
    }
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('mcpd Bridge Server started');
  }
}

// Start the server with parsed arguments
const bridge = new McpdBridgeServer(targetServer, useNamespacing);
bridge.start().catch((error) => {
  console.error('Failed to start bridge server:', error);
  process.exit(1);
});