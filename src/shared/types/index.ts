export interface MCPServer {
  name: string;
  package: string;
  tools: string[];
  status: "running" | "stopped" | "error" | "initializing";
  health?: "healthy" | "unhealthy" | "unknown";
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
  tools?: string[];
  env?: Record<string, string>;
  args?: string[];
}

export interface IpcChannels {
  // Daemon management
  "daemon:start": () => Promise<DaemonStatus>;
  "daemon:stop": () => Promise<void>;
  "daemon:status": () => Promise<DaemonStatus>;
  "daemon:logs": () => Promise<string[]>;

  // Server management
  "servers:list": () => Promise<MCPServer[]>;
  "servers:add": (server: ConfigEntry) => Promise<void>;
  "servers:remove": (name: string) => Promise<void>;
  "servers:tools": (name: string) => Promise<MCPTool[]>;

  // Tool execution
  "tool:call": (server: string, tool: string, args: any) => Promise<any>;

  // Configuration
  "config:load": () => Promise<ConfigEntry[]>;
  "config:save": (config: ConfigEntry[]) => Promise<void>;
  "config:export": () => Promise<string>;
}

export interface LogEntry {
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  message: string;
  source?: string;
}

// Registry types derived from the mozilla-ai/mcpd registry schema.

export interface RegistryPublisher {
  name: string;
  url?: string;
}

export interface RegistryRepository {
  type: "git" | "github";
  url: string;
  commit?: string;
}

export interface RegistryInstallation {
  runtime: "npx" | "uvx" | "docker";
  package: string;
  version: string;
  description?: string;
  recommended?: boolean;
  deprecated?: boolean;
  repository?: RegistryRepository;
}

export interface RegistryToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface RegistryTool {
  name: string;
  title?: string;
  description: string;
  annotations?: RegistryToolAnnotations;
}

export type RegistryArgumentType =
  | "environment"
  | "argument"
  | "argument_bool"
  | "argument_positional"
  | "volume";

export interface RegistryArgument {
  name: string;
  description: string;
  type: RegistryArgumentType;
  required?: boolean;
  example?: string;
  // Required when type is "argument_positional".
  position?: number;
  // Required when type is "volume".
  path?: string;
  from?: string;
}

export interface RegistryServer {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  homepage?: string;
  license: string;
  isOfficial?: boolean;
  deprecated?: boolean;
  categories?: string[];
  tags?: string[];
  publisher?: RegistryPublisher;
  installations: Record<string, RegistryInstallation>;
  arguments?: Record<string, RegistryArgument>;
  tools: RegistryTool[];
  transports?: ("stdio" | "sse" | "streamable-http")[];
}

// The bundled registry file is a map of server ID to RegistryServer.
export type RegistryData = Record<string, RegistryServer>;
