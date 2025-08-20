# MCPD Setup - Quick MCP Server Installation

A simple CLI tool that mimics Composio's approach for setting up MCP servers with Cursor, Claude Desktop, and other tools.

## Installation

```bash
npm install -g @mcpd/setup
```

Or run directly with npx:
```bash
npx @mcpd/setup
```

## Quick Start

### 1. List Available Servers

```bash
mcpd-setup list
```

This shows all your MCPD servers and their available tools.

### 2. Set Up a Server

Just like Composio, one command sets everything up:

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

1. **Checks Prerequisites**: Ensures MCPD is running and the server exists
2. **Starts HTTP Gateway**: Automatically starts the MCP-over-HTTP gateway if needed
3. **Configures the Client**: Updates the client's configuration file
4. **Ready to Use**: Just restart the client application

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

- **Cursor** - Full HTTP endpoint support (when available)
- **Claude Desktop** - Via STDIO bridge
- **Windsurf** - HTTP endpoint support (check their docs)

## The Composio Approach

This tool mimics Composio's excellent UX:

1. **One Command**: Single command to set up each server
2. **Per-Server**: Focus on individual servers, not complex configurations
3. **Automatic**: No manual JSON editing or configuration
4. **Simple**: Just works™

## Comparison with Composio

| Feature | Composio | MCPD Setup |
|---------|----------|------------|
| Setup Command | ✅ `npx @composio/mcp@latest setup` | ✅ `npx @mcpd/setup` |
| Per-Server Setup | ✅ Yes | ✅ Yes |
| Auto Configuration | ✅ Yes | ✅ Yes |
| Self-Hosted | ❌ Cloud | ✅ Local |
| Custom Servers | ❌ Limited | ✅ Any MCPD server |

## Configuration Locations

The tool automatically updates the right configuration files:

**Cursor**:
- macOS: `~/.cursor/mcp/config.json`
- Windows: `%APPDATA%\Cursor\mcp\config.json`
- Linux: `~/.config/cursor/mcp/config.json`

**Claude Desktop**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

## Troubleshooting

### "MCPD is not running"
Start MCPD first:
```bash
mcpd start
```
Or use the MCPD Client desktop app

### "Server not found"
List available servers:
```bash
mcpd-setup list
```

### Client doesn't see the server
1. Make sure you restarted the client application
2. Check that the HTTP gateway is running: `curl http://localhost:3001/health`
3. Verify the configuration file was updated correctly

## License

MIT