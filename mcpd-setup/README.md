# mcpd Setup - Quick MCP Server Installation

A simple CLI tool for setting up MCP servers with Cursor, Claude Desktop, and other IDEs. Configures [`@mozilla-ai/mcpd-proxy`](https://github.com/mozilla-ai/mcpd-proxy) as the STDIO bridge.

## Installation

This package is part of the mcpd-client monorepo. Install from the repository root:

```bash
# From the repository root
npm install

# Build the setup tool
cd mcpd-setup
npm run build

# Install the mcpd-setup command globally from source
cd ..
./install-global.sh
```

**Note:** You must run `./install-global.sh` to install the `mcpd-setup` command globally before using it.

## Quick Start

### 1. List Available Servers

```bash
mcpd-setup list
```

This shows all your mcpd servers and their available tools.

### 2. Set Up a Server

One command sets everything up:

#### For Cursor
```bash
mcpd-setup filesystem --client cursor
```

#### For Claude Desktop
```bash
mcpd-setup filesystem --client claude
```

#### For Windsurf
```bash
mcpd-setup filesystem --client windsurf
```

After running the command, restart the application to start using the MCP server.

## How It Works

1. **Checks Prerequisites**: Ensures mcpd is running and the server exists
2. **Configures mcpd-proxy**: Sets up `npx @mozilla-ai/mcpd-proxy` as the STDIO bridge in the client's config
3. **Ready to Use**: Just restart the client application

## Examples

### Setting up GitHub server for Cursor
```bash
mcpd-setup github --client cursor
```

### Setting up Memory server for Claude
```bash
mcpd-setup memory --client claude
```

### Setting up multiple servers
```bash
mcpd-setup filesystem --client cursor
mcpd-setup github --client cursor
mcpd-setup memory --client cursor
```

## Supported Clients

- **Cursor** - Via mcpd-proxy STDIO bridge
- **Claude Desktop** - Via mcpd-proxy STDIO bridge
- **Windsurf** - Via mcpd-proxy STDIO bridge
- **HTTP** - Direct access to mcpd HTTP API (port 8090)
- **Tunnel** - Cloudflare Tunnel for external access

## Configuration Locations

The tool automatically updates the right configuration files:

**Cursor**:
- macOS: `~/.cursor/mcp.json`
- Windows: `%APPDATA%\Cursor\mcp.json`
- Linux: `~/.config/cursor/mcp.json`

**Claude Desktop**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

## Troubleshooting

### "mcpd is not running"
Start mcpd first:
```bash
mcpd daemon
```
Or use the mcpd Client desktop app.

### "Server not found"
List available servers:
```bash
mcpd-setup list
```

### Client doesn't see the server
1. Make sure you restarted the client application
2. Check that mcpd is running: `curl http://localhost:8090/api/v1/servers`
3. Verify the configuration file was updated correctly

## License

Apache-2.0
