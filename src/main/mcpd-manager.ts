import { spawn, ChildProcess, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { McpdClient } from "@mozilla-ai/mcpd";
import * as TOML from "@iarna/toml";
import { app } from "electron";
import { DaemonStatus, MCPTool } from "@shared/types";

export class McpdManager {
  private daemonProcess: ChildProcess | null = null;
  private mcpdClient: McpdClient;
  private apiEndpoint: string;
  private logPath: string;
  private configPath: string;
  private secretsPath: string;
  private mcpdPath: string;
  private cachedMcpdVersion: string | null = null;

  constructor() {
    // Use proper user data directory for config and logs.
    const userDataPath = app.getPath("userData");
    this.logPath = path.join(userDataPath, "mcpd.log");
    this.configPath = path.join(userDataPath, ".mcpd.toml");

    // Read api.addr from config if set, otherwise use default.
    this.apiEndpoint = this.readApiEndpoint(this.configPath);
    this.mcpdClient = new McpdClient({
      apiEndpoint: this.apiEndpoint,
      timeout: 10000,
    });

    // Secrets file at the XDG config path used by mcpd in --dev mode.
    const configHome =
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    this.secretsPath = path.join(configHome, "mcpd", "secrets.dev.toml");

    // Find mcpd binary path.
    this.mcpdPath = this.findMcpdPath();

    // Ensure user data directory exists.
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  }

  async startDaemon(): Promise<DaemonStatus> {
    const logs: string[] = [];
    logs.push(`[${this.constructor.name}] startDaemon called`);
    logs.push(`[${this.constructor.name}] mcpdPath: ${this.mcpdPath}`);
    console.log(`[${this.constructor.name}] startDaemon called`);
    console.log(`[${this.constructor.name}] mcpdPath:`, this.mcpdPath);

    // First check if daemon is already running.
    const currentStatus = await this.getStatus();
    logs.push(
      `[${this.constructor.name}] Current daemon status: ${JSON.stringify(currentStatus)}`,
    );
    console.log(
      `[${this.constructor.name}] Current daemon status:`,
      currentStatus,
    );

    if (currentStatus.running) {
      logs.push("Daemon already running, connecting to existing instance");
      console.log("Daemon already running, connecting to existing instance");
      return currentStatus;
    }

    if (this.daemonProcess) {
      return this.getStatus();
    }

    return new Promise((resolve, reject) => {
      console.log(`[${this.constructor.name}] Starting daemon promise...`);
      logs.push(`[${this.constructor.name}] Starting daemon promise...`);

      // Validate mcpd exists.
      if (this.mcpdPath !== "mcpd" && !fs.existsSync(this.mcpdPath)) {
        const errorMsg = `mcpd binary not found at ${this.mcpdPath}. Install mcpd via Homebrew: brew install mozilla-ai/tap/mcpd`;
        console.error(`[${this.constructor.name}] Binary not found:`, errorMsg);
        logs.push(`[${this.constructor.name}] Binary not found: ${errorMsg}`);
        reject(new Error(errorMsg));
        return;
      }

      console.log(
        `[${this.constructor.name}] mcpd binary found at:`,
        this.mcpdPath,
      );
      logs.push(
        `[${this.constructor.name}] mcpd binary found at: ${this.mcpdPath}`,
      );

      // Check if config exists, if not create it.
      if (!fs.existsSync(this.configPath)) {
        this.initConfig();
      }

      // Ensure the secrets file exists so --runtime-file doesn't fail on first launch.
      if (!fs.existsSync(this.secretsPath)) {
        const secretsDir = path.dirname(this.secretsPath);
        if (!fs.existsSync(secretsDir)) {
          fs.mkdirSync(secretsDir, { recursive: true });
        }
        fs.writeFileSync(this.secretsPath, "");
      }

      console.log(`[${this.constructor.name}] Spawning daemon with args:`, [
        "daemon",
        "--dev",
        "--log-level=DEBUG",
        `--log-path=${this.logPath}`,
        `--config-file=${this.configPath}`,
        `--runtime-file=${this.secretsPath}`,
      ]);

      try {
        // Build PATH that includes Homebrew, system paths, and node locations.
        const nodeAdditional: string[] = [
          `${process.env.HOME}/.npm/bin`,
          `${process.env.HOME}/.local/bin`,
          "/usr/local/opt/node/bin",
          "/opt/homebrew/opt/node/bin",
          `${process.env.HOME}/.nvm/versions/node/v18.0.0/bin`,
          `${process.env.HOME}/.nvm/versions/node/v20.0.0/bin`,
        ];

        // Try to find node installation dynamically.
        try {
          const nodePath = execSync("which node", {
            encoding: "utf-8",
          }).trim();
          if (nodePath) {
            nodeAdditional.push(path.dirname(nodePath));
          }
        } catch {
          // Ignore if we can't find node.
        }

        const basePath = this.buildFullPath();
        const pathSet = new Set(basePath.split(path.delimiter).filter(Boolean));
        nodeAdditional.forEach((p) => pathSet.add(p));
        const fullPath = Array.from(pathSet).join(path.delimiter);

        this.daemonProcess = spawn(
          this.mcpdPath,
          [
            "daemon",
            "--dev",
            "--log-level=DEBUG",
            `--log-path=${this.logPath}`,
            `--config-file=${this.configPath}`,
            `--runtime-file=${this.secretsPath}`,
          ],
          {
            cwd: app.getPath("userData"),
            env: {
              ...process.env,
              PATH: fullPath,
              NODE_PATH:
                "/usr/local/lib/node_modules:/opt/homebrew/lib/node_modules",
            },
            detached: false,
          },
        );

        console.log(
          `[${this.constructor.name}] Daemon process spawned, pid:`,
          this.daemonProcess.pid,
        );
      } catch (spawnError) {
        console.error(
          `[${this.constructor.name}] Failed to spawn daemon:`,
          spawnError,
        );
        reject(new Error(`Failed to spawn daemon: ${spawnError}`));
        return;
      }

      let errorOutput = "";

      // Add a flag to track if we've already resolved/rejected.
      let hasResolved = false;

      // Add an absolute timeout to ensure we always resolve or reject.
      const absoluteTimeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          console.error(
            `[${this.constructor.name}] Daemon start absolute timeout reached`,
          );
          const errorMsg = `Daemon failed to start within 8 seconds. Path: ${this.mcpdPath}, Config: ${this.configPath}, Error output: ${errorOutput || "none"}`;
          reject(new Error(errorMsg));
        }
      }, 8000);

      this.daemonProcess.on("error", (error) => {
        console.error("Failed to start mcpd daemon:", error);
        this.daemonProcess = null;
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(absoluteTimeout);
          reject(new Error(`Failed to start daemon: ${error.message}`));
        }
      });

      this.daemonProcess.stdout?.on("data", (data) => {
        console.log(`mcpd stdout: ${data}`);
      });

      this.daemonProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        console.error(`mcpd stderr: ${output}`);
        errorOutput += output;

        // Check for port already in use error.
        if (output.includes("address already in use")) {
          this.daemonProcess?.kill();
          this.daemonProcess = null;

          // Try to connect to existing daemon.
          setTimeout(async () => {
            if (hasResolved) return;

            try {
              const status = await this.getStatus();
              if (status.running) {
                console.log("Connected to existing daemon instance");
                if (!hasResolved) {
                  hasResolved = true;
                  clearTimeout(absoluteTimeout);
                  resolve(status);
                }
              } else {
                if (!hasResolved) {
                  hasResolved = true;
                  clearTimeout(absoluteTimeout);
                  reject(
                    new Error(
                      "Port 8090 is in use but cannot connect to daemon",
                    ),
                  );
                }
              }
            } catch {
              if (!hasResolved) {
                hasResolved = true;
                clearTimeout(absoluteTimeout);
                reject(new Error("Port 8090 is in use by another application"));
              }
            }
          }, 500);
        }
      });

      this.daemonProcess.on("exit", (code) => {
        console.log(`mcpd daemon exited with code ${code}`);
        this.daemonProcess = null;

        if (errorOutput.includes("address already in use")) {
          // Already handled above.
          return;
        }

        if (code !== 0 && code !== null) {
          reject(new Error(`Daemon exited with code ${code}: ${errorOutput}`));
        }
      });

      // Wait for the daemon to start (servers may need time to initialize).
      setTimeout(async () => {
        if (hasResolved) return;

        try {
          const status = await this.getStatus();
          if (status.running) {
            hasResolved = true;
            clearTimeout(absoluteTimeout);
            console.log(
              `[${this.constructor.name}] Daemon started successfully`,
            );
            resolve(status);
          } else if (!errorOutput) {
            hasResolved = true;
            clearTimeout(absoluteTimeout);
            reject(
              new Error("Daemon failed to start - not running after 5 seconds"),
            );
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
    this.cachedMcpdVersion = null;
    if (this.daemonProcess) {
      return new Promise((resolve) => {
        this.daemonProcess!.on("exit", () => {
          this.daemonProcess = null;
          resolve();
        });
        this.daemonProcess!.kill("SIGTERM");
      });
    } else {
      // Try to stop external daemon using pkill.
      return new Promise((resolve, reject) => {
        const pkill = spawn("pkill", ["-f", "mcpd daemon"]);

        pkill.on("exit", (code) => {
          // pkill returns 0 if processes were found and killed, 1 if none found.
          if (code === 0 || code === 1) {
            resolve();
          } else {
            reject(new Error(`Failed to stop daemon, exit code: ${code}`));
          }
        });

        pkill.on("error", (error) => {
          console.error("Failed to execute pkill:", error);
          // Fallback: just resolve as we might not have pkill on all systems.
          resolve();
        });
      });
    }
  }

  async getStatus(): Promise<DaemonStatus> {
    try {
      // Use the SDK to check server health; success means daemon is running.
      await this.mcpdClient.getServerHealth();
      return {
        running: true,
        pid: this.daemonProcess?.pid,
        apiUrl: this.apiEndpoint,
        logPath: this.logPath,
      };
    } catch {
      // If health check fails, try listing servers as a fallback.
      try {
        await this.mcpdClient.listServers();
        return {
          running: true,
          pid: this.daemonProcess?.pid,
          apiUrl: this.apiEndpoint,
          logPath: this.logPath,
        };
      } catch {
        return {
          running: false,
          logPath: this.logPath,
        };
      }
    }
  }

  async getServers(): Promise<string[]> {
    try {
      return await this.mcpdClient.listServers();
    } catch (error) {
      console.error("Failed to get servers:", error);
      return [];
    }
  }

  async getServerTools(serverName: string): Promise<MCPTool[]> {
    try {
      const tools = await this.mcpdClient.servers[serverName].getTools();
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    } catch (error) {
      console.error(`Failed to get tools for ${serverName}:`, error);
      return [];
    }
  }

  async callTool(server: string, tool: string, args: any): Promise<any> {
    try {
      return await this.mcpdClient.servers[server].callTool(tool, args);
    } catch (error) {
      console.error(`Failed to call tool ${tool} on ${server}:`, error);
      throw error;
    }
  }

  async addServer(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(
        this.mcpdPath,
        ["add", name, `--config-file=${this.configPath}`],
        {
          cwd: app.getPath("userData"),
        },
      );

      proc.on("exit", (code) => {
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
      const proc = spawn(
        this.mcpdPath,
        ["remove", name, `--config-file=${this.configPath}`],
        {
          cwd: app.getPath("userData"),
        },
      );

      proc.on("exit", (code) => {
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

    const content = fs.readFileSync(this.logPath, "utf-8");
    const allLines = content.split("\n");
    return allLines.slice(-lines);
  }

  private readApiEndpoint(configPath: string): string {
    const defaultEndpoint = "http://localhost:8090";
    try {
      if (!fs.existsSync(configPath)) return defaultEndpoint;
      const content = fs.readFileSync(configPath, "utf-8");
      const config = TOML.parse(content) as any;
      const addr = config?.daemon?.api?.addr;
      if (!addr) return defaultEndpoint;
      // addr is "host:port" — prepend http:// if missing.
      return addr.startsWith("http") ? addr : `http://${addr}`;
    } catch {
      return defaultEndpoint;
    }
  }

  private initConfig(): void {
    const initialConfig = "servers = []";
    fs.writeFileSync(this.configPath, initialConfig);
  }

  async loadConfig(): Promise<any> {
    if (!fs.existsSync(this.configPath)) {
      return { servers: [], content: "servers = []" };
    }
    const content = fs.readFileSync(this.configPath, "utf-8");
    return { content };
  }

  async saveConfig(content: string): Promise<void> {
    fs.writeFileSync(this.configPath, content);
  }

  async searchServers(query: string = "*"): Promise<any[]> {
    return new Promise((resolve) => {
      const proc = spawn(
        this.mcpdPath,
        [
          "search",
          query,
          "--format",
          "json",
          `--config-file=${this.configPath}`,
        ],
        {
          cwd: app.getPath("userData"),
        },
      );

      let output = "";
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });

      proc.on("exit", (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(output);
            // mcpd search may return { results: [...] } or a plain array.
            const results = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.results)
                ? parsed.results
                : [];
            resolve(results);
          } catch {
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
    required_env?: string[];
    required_args?: string[];
    required_args_bool?: string[];
    required_args_positional?: string[];
  }): Promise<void> {
    console.log(
      `[${this.constructor.name}] addServerToConfig called with:`,
      server,
    );

    // Load existing config.
    const configContent = fs.readFileSync(this.configPath, "utf-8");
    const config = TOML.parse(configContent) as any;

    // Ensure servers array exists.
    if (!config.servers) {
      config.servers = [];
    }

    // Check for duplicate name.
    const exists = config.servers.some((s: any) => s.name === server.name);
    if (exists) {
      throw new Error(`Server with name '${server.name}' already exists`);
    }

    // Build new server entry matching mcpd's ServerEntry TOML format.
    const newServer: any = {
      name: server.name,
      package: server.package,
    };

    if (server.tools && server.tools.length > 0) {
      newServer.tools = server.tools;
    }
    if (server.required_env && server.required_env.length > 0) {
      newServer.required_env = server.required_env;
    }
    if (server.required_args && server.required_args.length > 0) {
      newServer.required_args = server.required_args;
    }
    if (server.required_args_bool && server.required_args_bool.length > 0) {
      newServer.required_args_bool = server.required_args_bool;
    }
    if (
      server.required_args_positional &&
      server.required_args_positional.length > 0
    ) {
      newServer.required_args_positional = server.required_args_positional;
    }

    // Add to config.
    config.servers.push(newServer);
    console.log(`[${this.constructor.name}] New server entry:`, newServer);

    // Write back to file.
    const tomlString = TOML.stringify(config);
    console.log(`[${this.constructor.name}] Writing new config:`, tomlString);
    fs.writeFileSync(this.configPath, tomlString);
    console.log(
      `[${this.constructor.name}] Config written successfully to:`,
      this.configPath,
    );

    // Restart daemon to pick up new configuration.
    console.log(
      `[${this.constructor.name}] Restarting daemon to load new server...`,
    );
    const wasRunning = await this.getStatus();
    if (wasRunning.running) {
      await this.stopDaemon();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await this.startDaemon();
      console.log(`[${this.constructor.name}] Daemon restarted successfully`);
    }
  }

  async removeServerFromConfig(name: string): Promise<void> {
    // Load existing config.
    const configContent = fs.readFileSync(this.configPath, "utf-8");
    const config = TOML.parse(configContent) as any;

    if (!config.servers) {
      throw new Error("No servers configured");
    }

    // Filter out the server.
    const originalLength = config.servers.length;
    config.servers = config.servers.filter((s: any) => s.name !== name);

    if (config.servers.length === originalLength) {
      throw new Error(`Server '${name}' not found`);
    }

    // Write back to file.
    const tomlString = TOML.stringify(config);
    fs.writeFileSync(this.configPath, tomlString);

    // Restart daemon to pick up configuration changes.
    console.log(
      `[${this.constructor.name}] Restarting daemon to reload configuration...`,
    );
    const wasRunning = await this.getStatus();
    if (wasRunning.running) {
      await this.stopDaemon();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await this.startDaemon();
      console.log(`[${this.constructor.name}] Daemon restarted successfully`);
    }
  }

  async getMcpdVersion(): Promise<string> {
    if (this.cachedMcpdVersion) return this.cachedMcpdVersion;

    return new Promise((resolve) => {
      const proc = spawn(this.mcpdPath, ["--version"], {
        cwd: app.getPath("userData"),
      });

      let output = "";
      let resolved = false;
      const done = (value: string) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        if (value !== "unknown") this.cachedMcpdVersion = value;
        resolve(value);
      };

      const timer = setTimeout(() => {
        proc.kill();
        done("unknown");
      }, 5000);

      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });

      proc.on("exit", (code) => {
        if (code === 0 && output.trim()) {
          // Parse version from output like "mcpd v0.3.0 (hash), built date".
          const match = output.match(/v[\d.]+/);
          done(match ? match[0] : output.trim());
        } else {
          done("unknown");
        }
      });

      proc.on("error", () => {
        done("unknown");
      });
    });
  }

  async saveServerSecrets(
    serverName: string,
    env: Record<string, string>,
    args: string[],
  ): Promise<void> {
    // Ensure the config directory exists.
    const secretsDir = path.dirname(this.secretsPath);
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true });
    }

    // Load existing secrets or start fresh.
    let secrets: any = {};
    if (fs.existsSync(this.secretsPath)) {
      try {
        const content = fs.readFileSync(this.secretsPath, "utf-8");
        secrets = TOML.parse(content);
      } catch (err) {
        console.error(
          `[${this.constructor.name}] Failed to parse ${this.secretsPath}, starting fresh:`,
          err,
        );
      }
    }

    if (!secrets.servers) {
      secrets.servers = {};
    }

    // Build the server section.
    const serverSection: any = {};
    if (args.length > 0) {
      serverSection.args = args;
    }
    const nonEmptyEnv = Object.fromEntries(
      Object.entries(env).filter(([, v]) => v !== ""),
    );
    if (Object.keys(nonEmptyEnv).length > 0) {
      serverSection.env = nonEmptyEnv;
    }

    secrets.servers[serverName] = serverSection;

    fs.writeFileSync(this.secretsPath, TOML.stringify(secrets));
    console.log(
      `[${this.constructor.name}] Server secrets saved to:`,
      this.secretsPath,
    );
  }

  getSecretsPath(): string {
    return this.secretsPath;
  }

  getApiEndpoint(): string {
    return this.apiEndpoint;
  }

  async getConfiguredServers(): Promise<any[]> {
    if (!fs.existsSync(this.configPath)) {
      return [];
    }

    const configContent = fs.readFileSync(this.configPath, "utf-8");
    const config = TOML.parse(configContent) as any;
    return config.servers || [];
  }

  isMcpdInstalled(): boolean {
    // Known absolute path — check if the file exists.
    if (this.mcpdPath !== "mcpd") {
      return fs.existsSync(this.mcpdPath);
    }
    // Bare "mcpd" fallback — check if it's resolvable via PATH.
    try {
      execSync("mcpd --version", { stdio: "ignore", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async installMcpd(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const proc = spawn("brew", ["install", "mozilla-ai/tap/mcpd"], {
        env: {
          ...process.env,
          PATH: this.buildFullPath(),
        },
      });

      let output = "";
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });
      proc.stderr?.on("data", (data) => {
        output += data.toString();
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          message: `Failed to run brew: ${err.message}. Is Homebrew installed?`,
        });
      });

      proc.on("exit", (code) => {
        if (code === 0) {
          // Refresh the cached path.
          this.mcpdPath = this.findMcpdPath();
          this.cachedMcpdVersion = null;
          resolve({
            success: true,
            message: "mcpd installed successfully.",
          });
        } else {
          resolve({
            success: false,
            message: `brew install failed (exit ${code}): ${output}`,
          });
        }
      });
    });
  }

  async upgradeMcpd(): Promise<{
    success: boolean;
    message: string;
    oldVersion?: string;
    newVersion?: string;
  }> {
    const oldVersion = await this.getMcpdVersion();

    return new Promise((resolve) => {
      const proc = spawn("brew", ["upgrade", "mozilla-ai/tap/mcpd"], {
        env: {
          ...process.env,
          PATH: this.buildFullPath(),
        },
      });

      let output = "";
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });
      proc.stderr?.on("data", (data) => {
        output += data.toString();
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          message: `Failed to run brew: ${err.message}. Is Homebrew installed?`,
        });
      });

      proc.on("exit", (code) => {
        // Refresh cached version regardless.
        this.cachedMcpdVersion = null;
        this.mcpdPath = this.findMcpdPath();

        if (code === 0) {
          this.getMcpdVersion()
            .then((newVersion) => {
              resolve({
                success: true,
                message:
                  oldVersion === newVersion
                    ? `mcpd is already up to date (${newVersion}).`
                    : `mcpd upgraded from ${oldVersion} to ${newVersion}.`,
                oldVersion,
                newVersion,
              });
            })
            .catch(() => {
              resolve({
                success: true,
                message: "mcpd upgraded successfully.",
                oldVersion,
              });
            });
        } else {
          resolve({
            success: false,
            message: `brew upgrade failed (exit ${code}): ${output}`,
          });
        }
      });
    });
  }

  async getBrewInfo(): Promise<{
    version: string;
    outdated: boolean;
  }> {
    try {
      const output = execSync(
        "brew info mozilla-ai/tap/mcpd --json=v2 2>/dev/null",
        {
          encoding: "utf-8",
          env: { ...process.env, PATH: this.buildFullPath() },
          timeout: 10000,
        },
      );
      const info = JSON.parse(output);
      const cask = info?.casks?.[0];
      const formula = info?.formulae?.[0];
      return {
        version: cask?.version || formula?.versions?.stable || "unknown",
        outdated: cask?.outdated ?? formula?.outdated ?? false,
      };
    } catch {
      return { version: "unknown", outdated: false };
    }
  }

  private buildFullPath(): string {
    const envPath = process.env.PATH || "";
    const additionalPaths = [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ];
    const delimiter = path.delimiter;
    const pathSet = new Set(envPath.split(delimiter).filter(Boolean));
    additionalPaths.forEach((p) => pathSet.add(p));
    return Array.from(pathSet).join(delimiter);
  }

  private findMcpdPath(): string {
    // Check well-known Homebrew / system paths.
    const systemPaths = [
      "/opt/homebrew/bin/mcpd",
      "/usr/local/bin/mcpd",
      "/usr/bin/mcpd",
    ];

    for (const mcpdPath of systemPaths) {
      try {
        if (fs.existsSync(mcpdPath)) {
          console.log(`Found mcpd at: ${mcpdPath}`);
          return mcpdPath;
        }
      } catch {
        // Continue checking.
      }
    }

    console.warn("mcpd not found in system paths, falling back to PATH lookup");
    return "mcpd";
  }
}
