import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Starting preload script');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Daemon management
    startDaemon: () => {
      console.log('[Preload] startDaemon called');
      return ipcRenderer.invoke('daemon:start');
    },
    stopDaemon: () => {
      console.log('[Preload] stopDaemon called');
      return ipcRenderer.invoke('daemon:stop');
    },
    getDaemonStatus: () => {
      console.log('[Preload] getDaemonStatus called');
      return ipcRenderer.invoke('daemon:status');
    },
    getDaemonLogs: (lines?: number) => ipcRenderer.invoke('daemon:logs', lines),

    // Server management
    listServers: () => ipcRenderer.invoke('servers:list'),
    addServer: (server: any) => 
      ipcRenderer.invoke('servers:add', server),
    removeServer: (name: string) => ipcRenderer.invoke('servers:remove', name),
    searchServers: (query: string) => ipcRenderer.invoke('servers:search', query),
    getServerTools: (name: string) => ipcRenderer.invoke('servers:tools', name),

    // Tool execution
    callTool: (server: string, tool: string, args: any) => 
      ipcRenderer.invoke('tool:call', server, tool, args),

    // Configuration
    loadConfig: () => ipcRenderer.invoke('config:load'),
    saveConfig: (content: string) => ipcRenderer.invoke('config:save', content),
    exportConfig: () => ipcRenderer.invoke('config:export'),
    
    // Test function
    test: () => {
      console.log('[Preload] test function called');
      return 'Preload is working!';
    }
  });
  
  console.log('[Preload] electronAPI exposed successfully');
  
  // Also expose a simple test to verify the bridge works
  contextBridge.exposeInMainWorld('preloadTest', {
    isWorking: true,
    version: '1.0.7'
  });
  
} catch (error) {
  console.error('[Preload] Failed to expose API:', error);
}