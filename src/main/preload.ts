import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Daemon management
  startDaemon: () => ipcRenderer.invoke('daemon:start'),
  stopDaemon: () => ipcRenderer.invoke('daemon:stop'),
  getDaemonStatus: () => ipcRenderer.invoke('daemon:status'),
  getDaemonLogs: (lines?: number) => ipcRenderer.invoke('daemon:logs', lines),

  // Server management
  listServers: () => ipcRenderer.invoke('servers:list'),
  addServer: (name: string, packageName: string) => 
    ipcRenderer.invoke('servers:add', name, packageName),
  removeServer: (name: string) => ipcRenderer.invoke('servers:remove', name),
  getServerTools: (name: string) => ipcRenderer.invoke('servers:tools', name),

  // Tool execution
  callTool: (server: string, tool: string, args: any) => 
    ipcRenderer.invoke('tool:call', server, tool, args),

  // Configuration
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (content: string) => ipcRenderer.invoke('config:save', content),
  exportConfig: () => ipcRenderer.invoke('config:export'),
});