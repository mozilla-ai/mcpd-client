import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';
import * as TOML from '@iarna/toml';
import { app } from 'electron';
import { DaemonStatus, MCPServer, MCPTool } from '@shared/types';

export class MCPDManager {
  private daemonProcess: ChildProcess | null = null;
  private apiClient: AxiosInstance;
  private logPath: string;
  private configPath: string;
  private mcpdPath: string;

  constructor() {
    this.apiClient = axios.create({
      baseURL: 'http://localhost:8090/api/v1',
      timeout: 10000,
    });
    
    // Use proper user data directory for config and logs
    const userDataPath = app.getPath('userData');
    this.logPath = path.join(userDataPath, 'mcpd.log');
    this.configPath = path.join(userDataPath, '.mcpd.toml');
    
    // Find mcpd binary path
    this.mcpdPath = this.findMcpdPath();
    
    // Ensure user data directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  }

  async startDaemon(): Promise<DaemonStatus> {
    const logs: string[] = [];
    logs.push('[MCPDManager] startDaemon called');
    logs.push(`[MCPDManager] mcpdPath: ${this.mcpdPath}`);
    console.log('[MCPDManager] startDaemon called');
    console.log('[MCPDManager] mcpdPath:', this.mcpdPath);
    
    // First check if daemon is already running
    const currentStatus = await this.getStatus();
    logs.push(`[MCPDManager] Current daemon status: ${JSON.stringify(currentStatus)}`);
    console.log('[MCPDManager] Current daemon status:', currentStatus);
    
    if (currentStatus.running) {
      logs.push('Daemon already running, connecting to existing instance');
      console.log('Daemon already running, connecting to existing instance');
      return currentStatus;
    }

    if (this.daemonProcess) {
      return this.getStatus();
    }

    return new Promise((resolve, reject) => {
      console.log('[MCPDManager] Starting daemon promise...');
      logs.push('[MCPDManager] Starting daemon promise...');
      
      // Validate mcpd exists
      if (this.mcpdPath !== 'mcpd' && !fs.existsSync(this.mcpdPath)) {
        const isSystemPath = this.mcpdPath.startsWith('/');
        const errorMsg = isSystemPath 
          ? `mcpd binary not found at ${this.mcpdPath}. This should not happen as mcpd is bundled with the app. Please report this issue.`
          : `mcpd binary not found at ${this.mcpdPath}. Please install mcpd using: go install github.com/mozilla-ai/mcpd@latest`;
        console.error('[MCPDManager] Binary not found:', errorMsg);
        logs.push(`[MCPDManager] Binary not found: ${errorMsg}`);
        reject(new Error(errorMsg));
        return;
      }
      
      console.log('[MCPDManager] mcpd binary found at:', this.mcpdPath);
      logs.push(`[MCPDManager] mcpd binary found at: ${this.mcpdPath}`);

      // Check if config exists, if not create it
      if (!fs.existsSync(this.configPath)) {
        this.initConfig();
      }

      console.log('[MCPDManager] Spawning daemon with args:', [
        'daemon',
        '--dev',
        '--log-level=DEBUG',
        `--log-path=${this.logPath}`,
        `--config-file=${this.configPath}`
      ]);
      
      try {
        // Ensure PATH includes common locations for node/npm/npx
        const envPath = process.env.PATH || '';
        const additionalPaths = [
          '/usr/local/bin',
          '/opt/homebrew/bin',
          '/usr/bin',
          '/bin',
          '/usr/sbin',
          '/sbin',
          `${process.env.HOME}/.npm/bin`,
          `${process.env.HOME}/.local/bin`,
          '/usr/local/opt/node/bin',
          '/opt/homebrew/opt/node/bin',
          `${process.env.HOME}/.nvm/versions/node/v18.0.0/bin`,
          `${process.env.HOME}/.nvm/versions/node/v20.0.0/bin`,
        ];
        
        // Try to find node installation dynamically
        try {
          const { execSync } = require('child_process');
          const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
          if (nodePath) {
            const nodeDir = path.dirname(nodePath);
            additionalPaths.push(nodeDir);
          }
        } catch (e) {
          // Ignore if we can't find node
        }
        
        // Combine paths, removing duplicates
        const pathSet = new Set(envPath.split(':').filter(Boolean));
        additionalPaths.forEach(p => pathSet.add(p));
        const fullPath = Array.from(pathSet).join(':');
        
        this.daemonProcess = spawn(this.mcpdPath, [
          'daemon',
          '--dev',
          '--log-level=DEBUG',
          `--log-path=${this.logPath}`,
          `--config-file=${this.configPath}`
        ], {
          cwd: app.getPath('userData'),
          env: { 
            ...process.env,
            PATH: fullPath,
            NODE_PATH: '/usr/local/lib/node_modules:/opt/homebrew/lib/node_modules'
          },
          detached: false,
        });
        
        console.log('[MCPDManager] Daemon process spawned, pid:', this.daemonProcess.pid);
      } catch (spawnError) {
        console.error('[MCPDManager] Failed to spawn daemon:', spawnError);
        reject(new Error(`Failed to spawn daemon: ${spawnError}`));
        return;
      }

      let errorOutput = '';
      
      // Add a flag to track if we've already resolved/rejected
      let hasResolved = false;
      
      // Add an absolute timeout to ensure we always resolve or reject
      const absoluteTimeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          console.error('[MCPDManager] Daemon start absolute timeout reached');
          const errorMsg = `Daemon failed to start within 8 seconds. Path: ${this.mcpdPath}, Config: ${this.configPath}, Error output: ${errorOutput || 'none'}`;
          reject(new Error(errorMsg));
        }
      }, 8000);

      this.daemonProcess.on('error', (error) => {
        console.error('Failed to start mcpd daemon:', error);
        this.daemonProcess = null;
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(absoluteTimeout);
          reject(new Error(`Failed to start daemon: ${error.message}`));
        }
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
            if (hasResolved) return;
            
            try {
              const status = await this.getStatus();
              if (status.running) {
                console.log('Connected to existing daemon instance');
                if (!hasResolved) {
                  hasResolved = true;
                  clearTimeout(absoluteTimeout);
                  resolve(status);
                }
              } else {
                if (!hasResolved) {
                  hasResolved = true;
                  clearTimeout(absoluteTimeout);
                  reject(new Error('Port 8090 is in use but cannot connect to daemon'));
                }
              }
            } catch (error) {
              if (!hasResolved) {
                hasResolved = true;
                clearTimeout(absoluteTimeout);
                reject(new Error('Port 8090 is in use by another application'));
              }
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
      
      // Wait for the daemon to start (servers may need time to initialize)
      setTimeout(async () => {
        if (hasResolved) return;
        
        try {
          const status = await this.getStatus();
          if (status.running) {
            hasResolved = true;
            clearTimeout(absoluteTimeout);
            console.log('[MCPDManager] Daemon started successfully');
            resolve(status);
          } else if (!errorOutput) {
            hasResolved = true;
            clearTimeout(absoluteTimeout);
            reject(new Error('Daemon failed to start - not running after 5 seconds'));
          }
        } catch (error) {
          if (!errorOutput && !hasResolved) {
            hasResolved = true;
            clearTimeout(absoluteTimeout);
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
      const proc = spawn(this.mcpdPath, ['add', name, `--config-file=${this.configPath}`], {
        cwd: app.getPath('userData'),
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
      const proc = spawn(this.mcpdPath, ['remove', name, `--config-file=${this.configPath}`], {
        cwd: app.getPath('userData'),
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
      const proc = spawn(this.mcpdPath, ['search', query, '--format', 'json', `--config-file=${this.configPath}`], {
        cwd: app.getPath('userData'),
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
    console.log('[MCPDManager] addServerToConfig called with:', server);
    
    // Load existing config
    const configContent = fs.readFileSync(this.configPath, 'utf-8');
    console.log('[MCPDManager] Current config content:', configContent);
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
    // Handle arguments - mcpd expects args as an array with separate elements
    if (server.requiredArgs && server.requiredArgs.length > 0) {
      const args: string[] = [];
      server.requiredArgs.forEach(arg => {
        // Split --key=value into ["--key", "value"]
        if (arg.includes('=')) {
          const [key, ...valueParts] = arg.split('=');
          args.push(key);
          args.push(valueParts.join('=')); // Handle cases where value contains '='
        } else {
          args.push(arg);
        }
      });
      newServer.args = args;
    }
    if (server.requiredArgsPositional && server.requiredArgsPositional.length > 0) {
      newServer.required_args_positional = server.requiredArgsPositional;
    }
    if (server.requiredArgsBool && server.requiredArgsBool.length > 0) {
      newServer.required_args_bool = server.requiredArgsBool;
    }

    // Add to config
    config.servers.push(newServer);
    console.log('[MCPDManager] New server entry:', newServer);

    // Write back to file
    const tomlString = TOML.stringify(config);
    console.log('[MCPDManager] Writing new config:', tomlString);
    fs.writeFileSync(this.configPath, tomlString);
    console.log('[MCPDManager] Config written successfully to:', this.configPath);
    
    // Restart daemon to pick up new configuration
    console.log('[MCPDManager] Restarting daemon to load new server...');
    const wasRunning = await this.getStatus();
    if (wasRunning.running) {
      await this.stopDaemon();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a moment for clean shutdown
      await this.startDaemon();
      console.log('[MCPDManager] Daemon restarted successfully');
    }
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
    
    // Restart daemon to pick up configuration changes
    console.log('[MCPDManager] Restarting daemon to reload configuration...');
    const wasRunning = await this.getStatus();
    if (wasRunning.running) {
      await this.stopDaemon();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a moment for clean shutdown
      await this.startDaemon();
      console.log('[MCPDManager] Daemon restarted successfully');
    }
  }

  async getConfiguredServers(): Promise<any[]> {
    if (!fs.existsSync(this.configPath)) {
      return [];
    }

    const configContent = fs.readFileSync(this.configPath, 'utf-8');
    const config = TOML.parse(configContent) as any;
    return config.servers || [];
  }

  private findMcpdPath(): string {
    // First priority: Check for existing system installation (for developers)
    const systemPaths = [
      '/opt/homebrew/bin/mcpd',     // Homebrew on Apple Silicon
      '/usr/local/bin/mcpd',        // Homebrew on Intel Mac / standard install
      '/usr/bin/mcpd',              // System install
    ];

    for (const mcpdPath of systemPaths) {
      try {
        if (fs.existsSync(mcpdPath)) {
          console.log(`Found existing mcpd installation at: ${mcpdPath}`);
          return mcpdPath;
        }
      } catch (error) {
        // Continue checking
      }
    }

    // Second priority: Use bundled mcpd binary
    const bundledPath = this.getBundledMcpdPath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      console.log(`Using bundled mcpd at: ${bundledPath}`);
      return bundledPath;
    }

    console.warn('mcpd not found in system paths or bundled, falling back to PATH lookup');
    return 'mcpd'; // Final fallback
  }

  private getBundledMcpdPath(): string | null {
    try {
      // Determine platform-specific binary name
      const platform = process.platform;
      const arch = process.arch;
      let binaryName = 'mcpd';
      
      if (platform === 'darwin') {
        binaryName = arch === 'arm64' ? 'mcpd-darwin-arm64' : 'mcpd-darwin-x64';
      } else if (platform === 'win32') {
        binaryName = 'mcpd.exe';
      } else if (platform === 'linux') {
        binaryName = 'mcpd-linux';
      }

      // In development, look in dist/resources
      const devPath = path.join(__dirname, 'resources', binaryName);
      if (fs.existsSync(devPath)) {
        console.log(`Found bundled mcpd in dev path: ${devPath}`);
        return devPath;
      }

      // In packaged app, check if we have process.resourcesPath
      if (typeof process.resourcesPath !== 'undefined') {
        // In packaged app, extraResources are placed in process.resourcesPath
        const prodPath = path.join(process.resourcesPath, 'resources', binaryName);
        if (fs.existsSync(prodPath)) {
          console.log(`Found bundled mcpd in prod path: ${prodPath}`);
          return prodPath;
        }

        // Alternative location in packaged app
        const altProdPath = path.join(process.resourcesPath, binaryName);
        if (fs.existsSync(altProdPath)) {
          console.log(`Found bundled mcpd in alt prod path: ${altProdPath}`);
          return altProdPath;
        }

        // Fallback: check in app.asar
        const asarPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'resources', binaryName);
        if (fs.existsSync(asarPath)) {
          console.log(`Found bundled mcpd in asar path: ${asarPath}`);
          return asarPath;
        }

        console.log(`Bundled mcpd not found in packaged app. Searched paths:`, [prodPath, altProdPath, asarPath]);
      } else {
        console.log(`process.resourcesPath not available, app might not be packaged`);
      }

      return null;
    } catch (error) {
      console.error('Error finding bundled mcpd:', error);
      return null;
    }
  }
}