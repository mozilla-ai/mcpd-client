export interface MCPServer {
  name: string;
  package: string;
  tools: string[];
  status: 'running' | 'stopped' | 'error' | 'initializing';
  health?: 'healthy' | 'unhealthy' | 'unknown';
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  apiUrl?: string;
  logPath?: string;
}

export interface ConfigEntry {
  name: string;
  package: string;
  tools: string[];
  required_env?: string[];
  required_args?: string[];
  required_args_positional?: string[];
  required_args_bool?: string[];
}

export interface IpcChannels {
  // Daemon management
  'daemon:start': () => Promise<DaemonStatus>;
  'daemon:stop': () => Promise<void>;
  'daemon:status': () => Promise<DaemonStatus>;
  'daemon:logs': () => Promise<string[]>;
  
  // Server management
  'servers:list': () => Promise<MCPServer[]>;
  'servers:add': (name: string, packageName: string) => Promise<void>;
  'servers:remove': (name: string) => Promise<void>;
  'servers:tools': (name: string) => Promise<MCPTool[]>;
  
  // Tool execution
  'tool:call': (server: string, tool: string, args: any) => Promise<any>;
  
  // Configuration
  'config:load': () => Promise<ConfigEntry[]>;
  'config:save': (config: ConfigEntry[]) => Promise<void>;
  'config:export': () => Promise<string>;
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  source?: string;
}