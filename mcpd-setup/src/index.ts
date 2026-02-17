#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// Client configuration paths.
const CLIENT_CONFIGS = {
  cursor: {
    mac: path.join(os.homedir(), '.cursor', 'mcp.json'),
    windows: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'mcp.json'),
    linux: path.join(os.homedir(), '.config', 'cursor', 'mcp.json')
  },
  claude: {
    mac: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    windows: path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    linux: path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json')
  },
  windsurf: {
    mac: path.join(os.homedir(), '.windsurf', 'mcp', 'config.json'),
    windows: path.join(os.homedir(), 'AppData', 'Roaming', 'Windsurf', 'mcp', 'config.json'),
    linux: path.join(os.homedir(), '.config', 'windsurf', 'mcp', 'config.json')
  }
};

// Get the right config path for the current OS.
function getConfigPath(client: string): string {
  const configs = CLIENT_CONFIGS[client as keyof typeof CLIENT_CONFIGS];
  if (!configs) {
    throw new Error(`Unknown client: ${client}`);
  }

  const platform = process.platform;
  if (platform === 'darwin') return configs.mac;
  if (platform === 'win32') return configs.windows;
  return configs.linux;
}

// Check if mcpd is running.
async function isMcpdRunning(): Promise<boolean> {
  try {
    await axios.get('http://localhost:8090/api/v1/servers');
    return true;
  } catch {
    return false;
  }
}

// Get available servers from mcpd.
async function getServers(): Promise<string[]> {
  try {
    const response = await axios.get('http://localhost:8090/api/v1/servers');
    // Handle both array format and object format.
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (response.data.servers || []).map((s: any) => s.name);
  } catch {
    return [];
  }
}

// Setup a server for a specific client.
async function setupServer(server: string, client: string, options: any) {
  const spinner = ora('Checking prerequisites...').start();

  try {
    // 1. Check if mcpd is running.
    if (!await isMcpdRunning()) {
      spinner.fail('mcpd is not running');
      console.log(chalk.red('\nPlease start mcpd first:'));
      console.log(chalk.cyan('  mcpd daemon'));
      console.log(chalk.gray('  or use the mcpd Client app'));
      process.exit(1);
    }

    // 2. Check if server exists.
    spinner.text = 'Checking server availability...';
    const servers = await getServers();
    if (!servers.includes(server)) {
      spinner.fail(`Server '${server}' not found`);
      console.log(chalk.red('\nAvailable servers:'));
      servers.forEach(s => console.log(chalk.cyan(`  - ${s}`)));
      process.exit(1);
    }

    // 3. Handle HTTP client type — just provide API info.
    if (client === 'http') {
      spinner.succeed(`HTTP API info for ${server} server`);

      const apiUrl = `http://localhost:8090/api/v1/servers/${server}/tools`;

      console.log('\n' + chalk.green('mcpd HTTP API is available directly:'));
      console.log(chalk.gray(`\nAPI URL: ${apiUrl}`));
      console.log(chalk.gray('\nUse this URL in your local applications, or install the SDK:'));
      console.log(chalk.cyan('  npm install @mozilla-ai/mcpd'));

      console.log('\n' + chalk.bold('Example usage:'));
      console.log(chalk.cyan(`curl ${apiUrl}`));

      console.log('\n' + chalk.yellow('Need STDIO for IDE integrations?'));
      console.log(chalk.cyan('  npx @mozilla-ai/mcpd-proxy'));
      return;
    }

    if (client === 'tunnel' || client === 'cloudflare') {
      // Start Cloudflare tunnel pointing at mcpd's HTTP API directly.
      spinner.text = 'Starting Cloudflare tunnel...';

      // Check if cloudflared is installed.
      const checkCloudflared = spawn('which', ['cloudflared']);
      let cloudflaredInstalled = false;

      await new Promise((resolve) => {
        checkCloudflared.on('exit', (code: number | null) => {
          cloudflaredInstalled = code === 0;
          resolve(undefined);
        });
      });

      if (!cloudflaredInstalled) {
        spinner.text = 'Installing cloudflared...';

        const platform = process.platform;
        let installCmd = '';

        if (platform === 'darwin') {
          installCmd = 'brew install cloudflared';
          console.log(chalk.yellow('\nCloudflared not found. Installing via Homebrew...'));
          console.log(chalk.gray('If this fails, install manually: brew install cloudflared'));
        } else if (platform === 'linux') {
          installCmd = 'curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared && chmod +x /tmp/cloudflared && sudo mv /tmp/cloudflared /usr/local/bin/';
          console.log(chalk.yellow('\nCloudflared not found. Installing...'));
        } else {
          spinner.fail('Cloudflared not found');
          console.log(chalk.red('\nPlease install cloudflared manually:'));
          console.log(chalk.cyan('  https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation'));
          return;
        }

        if (installCmd) {
          await new Promise((resolve) => {
            const install = spawn('sh', ['-c', installCmd]);
            install.on('exit', resolve);
          });
        }
      }

      // Start the tunnel pointing at mcpd directly.
      spinner.text = 'Creating public tunnel...';
      const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:8090']);

      let tunnelUrl = '';

      tunnel.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();

        // Extract the tunnel URL from cloudflared output.
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch && !tunnelUrl) {
          tunnelUrl = urlMatch[0];
          const fullUrl = `${tunnelUrl}/api/v1/servers/${server}/tools`;

          spinner.succeed('Public tunnel created!');

          console.log('\n' + chalk.green('Your mcpd API is now accessible from anywhere!'));
          console.log(chalk.bold.cyan(`\nPublic URL: ${tunnelUrl}`));

          console.log('\n' + chalk.bold('Test it:'));
          console.log(chalk.cyan(`curl ${fullUrl}`));

          console.log('\n' + chalk.bgRed.white(' IMPORTANT ') + chalk.red(' Keep this terminal open to maintain the tunnel'));
          console.log(chalk.gray('Press Ctrl+C to stop the tunnel\n'));
        }

        if (output.includes('error') || output.includes('Error')) {
          console.error(chalk.red(output));
        }
      });

      tunnel.on('error', (error: Error) => {
        spinner.fail('Failed to start tunnel');
        console.error(chalk.red(error.message));
      });

      tunnel.on('exit', (code: number | null) => {
        if (code !== 0 && !tunnelUrl) {
          spinner.fail('Tunnel process exited unexpectedly');
        }
        console.log(chalk.yellow('\nTunnel closed'));
      });

      // Keep the process running.
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nShutting down tunnel...'));
        tunnel.kill();
        process.exit();
      });

      return;
    }

    // 4. Configure desktop clients.
    spinner.text = `Configuring ${client}...`;
    const configPath = getConfigPath(client);

    // Read existing config or create new one.
    let config: any = {};
    if (await fs.pathExists(configPath)) {
      config = await fs.readJson(configPath);
    }

    // Add/update the server configuration using mcpd-proxy.
    if (client === 'claude') {
      // Claude Desktop format — uses mcpd-proxy for STDIO.
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[`mcpd-${server}`] = {
        command: 'npx',
        args: ['@mozilla-ai/mcpd-proxy'],
        env: {
          MCPD_ADDR: 'http://localhost:8090'
        }
      };
    } else if (client === 'cursor') {
      // Cursor format — uses mcpd-proxy for STDIO.
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[`mcpd-${server}`] = {
        command: 'npx',
        args: ['@mozilla-ai/mcpd-proxy'],
        env: {
          MCPD_ADDR: 'http://localhost:8090'
        }
      };
    } else {
      // Windsurf format.
      if (!config.mcp) config.mcp = {};
      if (!config.mcp.servers) config.mcp.servers = [];

      // Remove existing config for this server.
      config.mcp.servers = config.mcp.servers.filter((s: any) => s.name !== server);

      config.mcp.servers.push({
        name: server,
        command: 'npx',
        args: ['@mozilla-ai/mcpd-proxy'],
        env: {
          MCPD_ADDR: 'http://localhost:8090'
        }
      });
    }

    // Save the config.
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, config, { spaces: 2 });

    spinner.succeed(`Successfully configured ${client} with ${server} server`);

    // Show success message.
    console.log('\n' + chalk.green('Setup complete!'));
    console.log(chalk.gray(`\nConfig saved to: ${configPath}`));
    console.log(chalk.gray('Using mcpd-proxy (npx @mozilla-ai/mcpd-proxy) as the STDIO bridge'));

    if (client === 'claude') {
      console.log(chalk.yellow('\nPlease restart Claude Desktop to apply changes'));
    } else if (client === 'cursor') {
      console.log(chalk.yellow('\nPlease restart Cursor to apply changes'));
    } else if (client === 'windsurf') {
      console.log(chalk.yellow('\nPlease restart Windsurf to apply changes'));
      console.log(chalk.gray('Note: Check Windsurf docs for MCP support status'));
    }

  } catch (error: any) {
    spinner.fail('Setup failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// List available servers.
async function listServers() {
  const spinner = ora('Fetching servers...').start();

  try {
    if (!await isMcpdRunning()) {
      spinner.fail('mcpd is not running');
      console.log(chalk.red('\nPlease start mcpd first'));
      process.exit(1);
    }

    const servers = await getServers();
    spinner.succeed(`Found ${servers.length} servers`);

    console.log('\n' + chalk.bold('Available mcpd Servers:'));
    for (const server of servers) {
      console.log(chalk.cyan(`  ${server}`));

      // Try to get tools for each server.
      try {
        const response = await axios.get(`http://localhost:8090/api/v1/servers/${server}/tools`);
        const tools = response.data.tools || [];
        if (tools.length > 0) {
          console.log(chalk.gray(`    Tools: ${tools.slice(0, 3).map((t: any) => t.name).join(', ')}${tools.length > 3 ? '...' : ''}`));
        }
      } catch {
        // Ignore tool fetch errors.
      }
    }

    console.log('\n' + chalk.bold('Quick Setup Commands:'));
    console.log(chalk.gray('  For Cursor:  ') + chalk.cyan(`mcpd-setup <server> --client cursor`));
    console.log(chalk.gray('  For Claude:  ') + chalk.cyan(`mcpd-setup <server> --client claude`));
    console.log(chalk.gray('  For Windsurf:') + chalk.cyan(`mcpd-setup <server> --client windsurf`));

  } catch (error: any) {
    spinner.fail('Failed to fetch servers');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Main CLI setup.
program
  .name('mcpd-setup')
  .description('Quick setup tool for mcpd servers with Cursor, Claude, and other MCP clients')
  .version('1.0.0');

program
  .command('list')
  .description('List available mcpd servers')
  .action(listServers);

program
  .argument('[server]', 'Name of the mcpd server to set up')
  .option('-c, --client <client>', 'Client to configure (cursor, claude, windsurf, http, tunnel)', 'cursor')
  .option('--url <url>', 'Custom mcpd URL', 'http://localhost:8090')
  .description('Set up an mcpd server for a specific client')
  .action(async (server, options) => {
    if (!server) {
      // If no server specified, list available servers.
      await listServers();
    } else {
      await setupServer(server, options.client, options);
    }
  });

// Show banner.
console.log(chalk.bold.cyan('\nmcpd Setup Tool\n'));

program.parse();
