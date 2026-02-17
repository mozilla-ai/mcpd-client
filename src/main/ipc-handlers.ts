import { ipcMain } from 'electron';
import { McpdManager } from './mcpd-manager';

export function setupIPC(mcpdManager: McpdManager) {
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

  // Connect functionality - simplified one-click setup using mcpd-proxy.
  ipcMain.handle('connect:setup-claude', async (_, serverName: string) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Claude Desktop config path.
    const configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');

    // Read existing config or create new one.
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // Configure mcpd-proxy as the STDIO bridge for Claude Desktop.
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers[`mcpd-${serverName}`] = {
      command: 'npx',
      args: ['@mozilla-ai/mcpd-proxy'],
      env: {
        MCPD_ADDR: 'http://localhost:8090'
      }
    };

    // Save the config.
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return { success: true, message: 'Claude Desktop configured with mcpd-proxy. Please restart Claude Desktop.' };
  });

  ipcMain.handle('connect:setup-http', async (_, serverName: string) => {
    // The mcpd daemon exposes an HTTP API directly on port 8090.
    // No separate gateway process is needed.
    return {
      success: true,
      url: `http://localhost:8090/api/v1/servers/${serverName}/tools`,
      message: 'Use the mcpd HTTP API directly at http://localhost:8090. For STDIO-based IDE connections, use npx @mozilla-ai/mcpd-proxy.'
    };
  });

  ipcMain.handle('connect:setup-cursor', async (_, serverName: string) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Cursor MCP config path.
    const configPath = path.join(os.homedir(), '.cursor', 'mcp.json');

    // Read existing config or create new one.
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // Configure mcpd-proxy as the STDIO bridge for Cursor.
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers[`mcpd-${serverName}`] = {
      command: 'npx',
      args: ['@mozilla-ai/mcpd-proxy'],
      env: {
        MCPD_ADDR: 'http://localhost:8090'
      }
    };

    // Save the config.
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return { success: true, message: 'Cursor configured with mcpd-proxy. Please restart Cursor.' };
  });
}