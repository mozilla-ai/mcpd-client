import { ipcMain } from 'electron';
import { MCPDManager } from './mcpd-manager';

export function setupIPC(mcpdManager: MCPDManager) {
  // Test handler to verify IPC is working
  ipcMain.handle('test:ping', async () => {
    console.log('[Main] test:ping received');
    return 'pong';
  });
  
  // Daemon management
  ipcMain.handle('daemon:start', async () => {
    console.log('[Main] daemon:start IPC received');
    try {
      const result = await mcpdManager.startDaemon();
      console.log('[Main] daemon:start result:', result);
      return result;
    } catch (error: any) {
      console.error('[Main] daemon:start error:', error);
      throw error;
    }
  });

  ipcMain.handle('daemon:stop', async () => {
    console.log('[Main] daemon:stop IPC received');
    return await mcpdManager.stopDaemon();
  });

  ipcMain.handle('daemon:status', async () => {
    console.log('[Main] daemon:status IPC received');
    const status = await mcpdManager.getStatus();
    console.log('[Main] daemon:status result:', status);
    return status;
  });

  ipcMain.handle('daemon:logs', async (_, lines: number = 100) => {
    return await mcpdManager.getLogs(lines);
  });

  // Server management
  ipcMain.handle('servers:list', async () => {
    const serverNames = await mcpdManager.getServers();
    const configuredServers = await mcpdManager.getConfiguredServers();
    const servers = [];
    
    for (const name of serverNames) {
      const configServer = configuredServers.find(s => s.name === name);
      servers.push({
        name,
        package: configServer?.package || '',
        tools: [],
        status: 'running' as const,
        health: 'healthy' as const,
      });
    }
    
    return servers;
  });

  ipcMain.handle('servers:add', async (_, server: any) => {
    console.log('[Main] servers:add received:', server);
    try {
      const result = await mcpdManager.addServerToConfig(server);
      console.log('[Main] Server added successfully');
      return result;
    } catch (error: any) {
      console.error('[Main] Failed to add server:', error);
      throw error;
    }
  });

  ipcMain.handle('servers:remove', async (_, name: string) => {
    return await mcpdManager.removeServerFromConfig(name);
  });

  ipcMain.handle('servers:search', async (_, query: string) => {
    return await mcpdManager.searchServers(query);
  });

  ipcMain.handle('servers:tools', async (_, name: string) => {
    return await mcpdManager.getServerTools(name);
  });

  // Tool execution
  ipcMain.handle('tool:call', async (_, server: string, tool: string, args: any) => {
    return await mcpdManager.callTool(server, tool, args);
  });

  // Configuration
  ipcMain.handle('config:load', async () => {
    return await mcpdManager.loadConfig();
  });

  ipcMain.handle('config:save', async (_, content: string) => {
    return await mcpdManager.saveConfig(content);
  });

  ipcMain.handle('config:export', async () => {
    const config = await mcpdManager.loadConfig();
    return JSON.stringify(config, null, 2);
  });

  // Connect functionality - simplified one-click setup
  ipcMain.handle('connect:setup-claude', async (_, serverName: string) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Claude Desktop config path
    const configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    
    // Read existing config or create new one
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    // Add/update the server configuration
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers[`mcpd-${serverName}`] = {
      command: 'node',
      args: ['/Users/ameckes/Downloads/mcpd-client/mcpd-bridge-server/dist/index.js'],
      env: {
        MCPD_SERVER: serverName,
        MCPD_URL: 'http://localhost:8090'
      }
    };
    
    // Save the config
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    return { success: true, message: 'Claude Desktop configured. Please restart Claude Desktop.' };
  });

  ipcMain.handle('connect:setup-http', async (_, serverName: string) => {
    const { spawn } = require('child_process');
    
    // Start the HTTP gateway (if not already running)
    const gateway = spawn('npm', ['run', 'start'], {
      detached: true,
      stdio: 'ignore',
      cwd: '/Users/ameckes/Downloads/mcpd-client/mcpd-http-gateway'
    });
    
    gateway.unref();
    
    // Return the URL
    return { 
      success: true, 
      url: `http://localhost:3001/partner/mcpd/${serverName}/mcp`,
      message: 'HTTP Gateway started. Use the URL above in your application.'
    };
  });

  ipcMain.handle('connect:setup-cursor', async (_, serverName: string) => {
    // For now, just return instructions since Cursor's MCP support is still evolving
    return {
      success: true,
      message: 'Cursor integration coming soon. Check Cursor documentation for latest MCP support.',
      url: `http://localhost:3001/partner/mcpd/${serverName}/mcp`
    };
  });
}