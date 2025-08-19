import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';
import * as TOML from '@iarna/toml';
import { DaemonStatus, MCPServer, MCPTool } from '@shared/types';

export class MCPDManager {
  private daemonProcess: ChildProcess | null = null;
  private apiClient: AxiosInstance;
  private logPath: string;
  private configPath: string;

  constructor() {
    this.apiClient = axios.create({
      baseURL: 'http://localhost:8090/api/v1',
      timeout: 10000,
    });
    
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.logPath = path.join(homeDir, '.mcpd-client', 'mcpd.log');
    this.configPath = path.join(process.cwd(), '.mcpd.toml');
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  async startDaemon(): Promise<DaemonStatus> {
    // First check if daemon is already running
    const currentStatus = await this.getStatus();
    if (currentStatus.running) {
      console.log('Daemon already running, connecting to existing instance');
      return currentStatus;
    }

    if (this.daemonProcess) {
      return this.getStatus();
    }

    return new Promise((resolve, reject) => {
      // Check if config exists, if not create it
      if (!fs.existsSync(this.configPath)) {
        this.initConfig();
      }

      this.daemonProcess = spawn('mcpd', [
        'daemon',
        '--dev',
        '--log-level=DEBUG',
        `--log-path=${this.logPath}`
      ], {
        cwd: process.cwd(),
        env: { ...process.env },
        detached: false,
      });

      let errorOutput = '';

      this.daemonProcess.on('error', (error) => {
        console.error('Failed to start mcpd daemon:', error);
        this.daemonProcess = null;
        reject(new Error(`Failed to start daemon: ${error.message}`));
      });

      this.daemonProcess.stdout?.on('data', (data) => {
        console.log(`mcpd stdout: ${data}`);
      });

      this.daemonProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        console.error(`mcpd stderr: ${output}`);
        errorOutput += output;
        
        // Check for port already in use error
        if (output.includes('address already in use')) {
          this.daemonProcess?.kill();
          this.daemonProcess = null;
          
          // Try to connect to existing daemon
          setTimeout(async () => {
            try {
              const status = await this.getStatus();
              if (status.running) {
                console.log('Connected to existing daemon instance');
                resolve(status);
              } else {
                reject(new Error('Port 8090 is in use but cannot connect to daemon'));
              }
            } catch (error) {
              reject(new Error('Port 8090 is in use by another application'));
            }
          }, 500);
        }
      });

      this.daemonProcess.on('exit', (code) => {
        console.log(`mcpd daemon exited with code ${code}`);
        this.daemonProcess = null;
        
        if (errorOutput.includes('address already in use')) {
          // Already handled above
          return;
        }
        
        if (code !== 0 && code !== null) {
          reject(new Error(`Daemon exited with code ${code}: ${errorOutput}`));
        }
      });

      // Wait longer for the daemon to start (servers may need time to initialize)
      setTimeout(async () => {
        try {
          const status = await this.getStatus();
          if (status.running) {
            resolve(status);
          } else if (!errorOutput) {
            reject(new Error('Daemon failed to start'));
          }
        } catch (error) {
          if (!errorOutput) {
            reject(error);
          }
        }
      }, 5000);
    });
  }

  async stopDaemon(): Promise<void> {
    if (this.daemonProcess) {
      return new Promise((resolve) => {
        this.daemonProcess!.on('exit', () => {
          this.daemonProcess = null;
          resolve();
        });
        this.daemonProcess!.kill('SIGTERM');
      });
    } else {
      // Try to stop external daemon using pkill
      return new Promise((resolve, reject) => {
        const pkill = spawn('pkill', ['-f', 'mcpd daemon']);
        
        pkill.on('exit', (code) => {
          // pkill returns 0 if processes were found and killed, 1 if none found
          if (code === 0 || code === 1) {
            resolve();
          } else {
            reject(new Error(`Failed to stop daemon, exit code: ${code}`));
          }
        });
        
        pkill.on('error', (error) => {
          console.error('Failed to execute pkill:', error);
          // Fallback: just resolve as we might not have pkill on all systems
          resolve();
        });
      });
    }
  }

  async getStatus(): Promise<DaemonStatus> {
    try {
      // Try the health/servers endpoint which exists in the API
      const response = await this.apiClient.get('/health/servers');
      return {
        running: true,
        pid: this.daemonProcess?.pid,
        apiUrl: 'http://localhost:8090',
        logPath: this.logPath,
      };
    } catch (error) {
      // If that fails, try the servers endpoint as a fallback
      try {
        await this.apiClient.get('/servers');
        return {
          running: true,
          pid: this.daemonProcess?.pid,
          apiUrl: 'http://localhost:8090',
          logPath: this.logPath,
        };
      } catch (fallbackError) {
        return {
          running: false,
          logPath: this.logPath,
        };
      }
    }
  }

  async getServers(): Promise<string[]> {
    try {
      const response = await this.apiClient.get('/servers');
      return response.data;
    } catch (error) {
      console.error('Failed to get servers:', error);
      return [];
    }
  }

  async getServerTools(serverName: string): Promise<MCPTool[]> {
    try {
      const response = await this.apiClient.get(`/servers/${serverName}/tools`);
      return response.data.tools || [];
    } catch (error) {
      console.error(`Failed to get tools for ${serverName}:`, error);
      return [];
    }
  }

  async callTool(server: string, tool: string, args: any): Promise<any> {
    try {
      const response = await this.apiClient.post(
        `/servers/${server}/tools/${tool}`,
        args
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to call tool ${tool} on ${server}:`, error);
      throw error;
    }
  }

  async addServer(name: string, packageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('mcpd', ['add', name], {
        cwd: process.cwd(),
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to add server ${name}`));
        }
      });
    });
  }

  async removeServer(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('mcpd', ['remove', name], {
        cwd: process.cwd(),
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to remove server ${name}`));
        }
      });
    });
  }

  async getLogs(lines: number = 100): Promise<string[]> {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const allLines = content.split('\n');
    return allLines.slice(-lines);
  }

  private initConfig(): void {
    const initialConfig = 'servers = []';
    fs.writeFileSync(this.configPath, initialConfig);
  }

  async loadConfig(): Promise<any> {
    if (!fs.existsSync(this.configPath)) {
      return { servers: [], content: 'servers = []' };
    }
    const content = fs.readFileSync(this.configPath, 'utf-8');
    return { content };
  }

  async saveConfig(content: string): Promise<void> {
    fs.writeFileSync(this.configPath, content);
  }

  async searchServers(query: string = '*'): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn('mcpd', ['search', query, '--format', 'json'], {
        cwd: process.cwd(),
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          try {
            const results = JSON.parse(output);
            resolve(results);
          } catch (error) {
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });
  }

  async addServerToConfig(server: {
    name: string;
    package: string;
    tools?: string[];
    requiredEnv?: string[];
    requiredArgs?: string[];
    requiredArgsPositional?: string[];
    requiredArgsBool?: string[];
  }): Promise<void> {
    // Load existing config
    const configContent = fs.readFileSync(this.configPath, 'utf-8');
    const config = TOML.parse(configContent) as any;

    // Ensure servers array exists
    if (!config.servers) {
      config.servers = [];
    }

    // Check for duplicate name
    const exists = config.servers.some((s: any) => s.name === server.name);
    if (exists) {
      throw new Error(`Server with name '${server.name}' already exists`);
    }

    // Build new server entry
    const newServer: any = {
      name: server.name,
      package: server.package,
    };

    if (server.tools && server.tools.length > 0) {
      newServer.tools = server.tools;
    }
    if (server.requiredEnv && server.requiredEnv.length > 0) {
      newServer.required_env = server.requiredEnv;
    }
    if (server.requiredArgs && server.requiredArgs.length > 0) {
      newServer.required_args = server.requiredArgs;
    }
    if (server.requiredArgsPositional && server.requiredArgsPositional.length > 0) {
      newServer.required_args_positional = server.requiredArgsPositional;
    }
    if (server.requiredArgsBool && server.requiredArgsBool.length > 0) {
      newServer.required_args_bool = server.requiredArgsBool;
    }

    // Add to config
    config.servers.push(newServer);

    // Write back to file
    const tomlString = TOML.stringify(config);
    fs.writeFileSync(this.configPath, tomlString);
  }

  async removeServerFromConfig(name: string): Promise<void> {
    // Load existing config
    const configContent = fs.readFileSync(this.configPath, 'utf-8');
    const config = TOML.parse(configContent) as any;

    if (!config.servers) {
      throw new Error('No servers configured');
    }

    // Filter out the server
    const originalLength = config.servers.length;
    config.servers = config.servers.filter((s: any) => s.name !== name);

    if (config.servers.length === originalLength) {
      throw new Error(`Server '${name}' not found`);
    }

    // Write back to file
    const tomlString = TOML.stringify(config);
    fs.writeFileSync(this.configPath, tomlString);
  }

  async getConfiguredServers(): Promise<any[]> {
    if (!fs.existsSync(this.configPath)) {
      return [];
    }

    const configContent = fs.readFileSync(this.configPath, 'utf-8');
    const config = TOML.parse(configContent) as any;
    return config.servers || [];
  }
}