import { ipcMain } from 'electron';
import { MCPDManager } from './mcpd-manager';

export function setupIPC(mcpdManager: MCPDManager) {
  // Daemon management
  ipcMain.handle('daemon:start', async () => {
    return await mcpdManager.startDaemon();
  });

  ipcMain.handle('daemon:stop', async () => {
    return await mcpdManager.stopDaemon();
  });

  ipcMain.handle('daemon:status', async () => {
    return await mcpdManager.getStatus();
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
    return await mcpdManager.addServerToConfig(server);
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
}