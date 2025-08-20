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

// Client configuration paths
const CLIENT_CONFIGS = {
  cursor: {
    mac: path.join(os.homedir(), '.cursor', 'mcp', 'config.json'),
    windows: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'mcp', 'config.json'),
    linux: path.join(os.homedir(), '.config', 'cursor', 'mcp', 'config.json')
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

// Get the right config path for the current OS
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

// Check if MCPD is running
async function isMCPDRunning(): Promise<boolean> {
  try {
    await axios.get('http://localhost:8090/api/v1/servers');
    return true;
  } catch {
    return false;
  }
}

// Check if HTTP gateway is running
async function isGatewayRunning(): Promise<boolean> {
  try {
    await axios.get('http://localhost:3001/health');
    return true;
  } catch {
    return false;
  }
}

// Get available servers from MCPD
async function getServers(): Promise<string[]> {
  try {
    const response = await axios.get('http://localhost:8090/api/v1/servers');
    // Handle both array format and object format
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (response.data.servers || []).map((s: any) => s.name);
  } catch {
    return [];
  }
}

// Start the HTTP gateway in background
function startGateway(): Promise<void> {
  return new Promise((resolve) => {
    console.log(chalk.yellow('Starting MCPD HTTP Gateway...'));
    
    const gateway = spawn('npm', ['run', 'start:mcp'], {
      detached: true,
      stdio: 'ignore',
      cwd: '/Users/ameckes/Downloads/mcpd-client/mcpd-http-gateway'
    });
    
    gateway.unref();
    
    // Wait a bit for it to start
    setTimeout(resolve, 3000);
  });
}

// Setup a server for a specific client
async function setupServer(server: string, client: string, options: any) {
  const spinner = ora('Checking prerequisites...').start();
  
  try {
    // 1. Check if MCPD is running
    if (!await isMCPDRunning()) {
      spinner.fail('MCPD is not running');
      console.log(chalk.red('\nPlease start MCPD first:'));
      console.log(chalk.cyan('  mcpd start'));
      console.log(chalk.gray('  or use the MCPD Client app'));
      process.exit(1);
    }
    
    // 2. Check if server exists
    spinner.text = 'Checking server availability...';
    const servers = await getServers();
    if (!servers.includes(server)) {
      spinner.fail(`Server '${server}' not found`);
      console.log(chalk.red('\nAvailable servers:'));
      servers.forEach(s => console.log(chalk.cyan(`  - ${s}`)));
      process.exit(1);
    }
    
    // 3. For HTTP or any client that needs it, start gateway if not running
    if (!await isGatewayRunning()) {
      spinner.text = 'Starting HTTP Gateway...';
      await startGateway();
    }
    
    // 4. Handle different client types
    if (client === 'http') {
      // For HTTP client, just provide the endpoint
      spinner.succeed(`HTTP endpoint ready for ${server} server`);
      
      console.log('\n' + chalk.green('✅ HTTP Gateway started!'));
      console.log(chalk.gray(`\nServer URL: http://localhost:3001/partner/mcpd/${server}/mcp`));
      console.log(chalk.gray('\nUse this URL in your HTTP client or application.'));
      console.log('\n' + chalk.bold('Example usage:'));
      console.log(chalk.cyan(`curl -X POST http://localhost:3001/partner/mcpd/${server}/mcp \\`));
      console.log(chalk.cyan(`  -H "Content-Type: application/json" \\`));
      console.log(chalk.cyan(`  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`));
      return;
    }
    
    // 5. Configure desktop clients
    spinner.text = `Configuring ${client}...`;
    const configPath = getConfigPath(client);
    const serverUrl = `http://localhost:3001/partner/mcpd/${server}/mcp`;
    
    // Read existing config or create new one
    let config: any = {};
    if (await fs.pathExists(configPath)) {
      config = await fs.readJson(configPath);
    }
    
    // Add/update the server configuration
    if (client === 'claude') {
      // Claude Desktop format
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[`mcpd-${server}`] = {
        command: 'node',
        args: ['/Users/ameckes/Downloads/mcpd-client/mcpd-bridge-server/dist/index.js'],
        env: {
          MCPD_SERVER: server,
          MCPD_URL: 'http://localhost:8090'
        }
      };
    } else {
      // Cursor/Windsurf format (when they support it)
      if (!config.mcp) config.mcp = {};
      if (!config.mcp.servers) config.mcp.servers = [];
      
      // Remove existing config for this server
      config.mcp.servers = config.mcp.servers.filter((s: any) => s.name !== server);
      
      // Add new config
      config.mcp.servers.push({
        name: server,
        url: serverUrl
      });
    }
    
    // Save the config
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, config, { spaces: 2 });
    
    spinner.succeed(`Successfully configured ${client} with ${server} server`);
    
    // Show success message
    console.log('\n' + chalk.green('✅ Setup complete!'));
    console.log(chalk.gray(`\nServer URL: ${serverUrl}`));
    console.log(chalk.gray(`Config saved to: ${configPath}`));
    
    if (client === 'claude') {
      console.log(chalk.yellow('\n⚠️  Please restart Claude Desktop to apply changes'));
    } else if (client === 'cursor') {
      console.log(chalk.yellow('\n⚠️  Please restart Cursor to apply changes'));
      console.log(chalk.gray('Note: Cursor MCP support is still in development'));
    } else if (client === 'windsurf') {
      console.log(chalk.yellow('\n⚠️  Please restart Windsurf to apply changes'));
      console.log(chalk.gray('Note: Check Windsurf docs for MCP support status'));
    }
    
  } catch (error: any) {
    spinner.fail('Setup failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// List available servers
async function listServers() {
  const spinner = ora('Fetching servers...').start();
  
  try {
    if (!await isMCPDRunning()) {
      spinner.fail('MCPD is not running');
      console.log(chalk.red('\nPlease start MCPD first'));
      process.exit(1);
    }
    
    const servers = await getServers();
    spinner.succeed(`Found ${servers.length} servers`);
    
    console.log('\n' + chalk.bold('Available MCPD Servers:'));
    for (const server of servers) {
      console.log(chalk.cyan(`  ${server}`));
      
      // Try to get tools for each server
      try {
        const response = await axios.get(`http://localhost:8090/api/v1/servers/${server}/tools`);
        const tools = response.data.tools || [];
        if (tools.length > 0) {
          console.log(chalk.gray(`    Tools: ${tools.slice(0, 3).map((t: any) => t.name).join(', ')}${tools.length > 3 ? '...' : ''}`));
        }
      } catch {
        // Ignore tool fetch errors
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

// Main CLI setup
program
  .name('mcpd-setup')
  .description('Quick setup tool for MCPD servers with Cursor, Claude, and other MCP clients')
  .version('1.0.0');

program
  .command('list')
  .description('List available MCPD servers')
  .action(listServers);

program
  .argument('[server]', 'Name of the MCPD server to set up')
  .option('-c, --client <client>', 'Client to configure (cursor, claude, windsurf)', 'cursor')
  .option('--url <url>', 'Custom MCPD URL', 'http://localhost:8090')
  .description('Set up an MCPD server for a specific client')
  .action(async (server, options) => {
    if (!server) {
      // If no server specified, list available servers
      await listServers();
    } else {
      await setupServer(server, options.client, options);
    }
  });

// Show colorful banner
console.log(chalk.bold.cyan('\n🚀 MCPD Setup Tool\n'));

program.parse();