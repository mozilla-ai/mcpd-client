# MCPD Client

A comprehensive ecosystem for managing MCP (Model Context Protocol) servers with Mozilla's mcpd daemon, featuring an Electron desktop app, STDIO bridge for Claude Desktop, HTTP gateway for universal access, and a CLI tool for quick client setup.

## 🎯 Core Components

### 1. **MCPD Client** (Electron App)
Visual desktop application for managing MCP servers with dashboard, configuration editor, and real-time monitoring.

### 2. **MCPD Bridge Server** (STDIO)
Native MCP protocol bridge for Claude Desktop integration with flexible unified/individual server modes.

### 3. **MCPD HTTP Gateway** (REST/WebSocket)
Universal HTTP/HTTPS gateway exposing MCP servers via REST API and WebSocket for web apps, Claude Code, Cursor, and any HTTP client.

### 4. **MCPD Setup CLI**
Command-line tool for quick setup of MCP servers with various clients (Claude, Cursor, HTTP, Tunnel).

## Features

- **Visual Server Management**: Add, remove, and monitor MCP servers through an intuitive UI
- **Tool Explorer**: Browse and test MCP tools with live execution
- **Configuration Editor**: Edit `.mcpd.toml` files with syntax highlighting
- **Real-time Logs**: Monitor daemon and server logs with filtering and search
- **System Tray Integration**: Run in background with quick access controls
- **Dashboard**: Overview of system status, active servers, and available tools
- **Multiple Access Methods**:
  - STDIO Bridge for Claude Desktop
  - HTTP Gateway for web/API access
  - Cloudflare Tunnels for external access (no account needed)
  - Direct MCPD API access
- **One-Click Client Setup**: Quick configuration for Claude, Cursor, and other MCP clients
- **Export Configurations**: Generate configs for various platforms and tools

## Prerequisites

- Node.js 16+ and npm
- mcpd installed (`brew install mozilla-ai/tap/mcpd` or from [GitHub releases](https://github.com/mozilla-ai/mcpd/releases))
- npx (for JavaScript MCP servers)
- uvx (for Python MCP servers)

## Installation

```bash
# Clone the repository
git clone https://github.com/alexmeckes/mcpd-client.git
cd mcpd-client

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run dist

# Platform-specific builds
npm run dist:mac    # macOS
npm run dist:win    # Windows
npm run dist:linux  # Linux
```

## Architecture

The application consists of:

- **Main Process**: Manages the mcpd daemon, handles IPC, and system tray
- **Renderer Process**: React-based UI with Ant Design components
- **mcpd Integration**: Communicates with mcpd's HTTP API on port 8090

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **TypeScript**: Type safety
- **Ant Design**: UI component library
- **Monaco Editor**: Code editing for configurations
- **xterm.js**: Terminal emulator for logs

## Usage

### Using the Desktop Client

1. **Start the Daemon**: Click the power button in the header or use the system tray menu
2. **Add Servers**: Navigate to the Servers tab and click "Add Server"
3. **Quick Connect**: Use the Connect tab for one-click setup with Claude, Cursor, or HTTP gateway
4. **Explore Tools**: Use the Tools tab to browse and test available MCP tools
5. **Edit Configuration**: Modify `.mcpd.toml` directly in the Configuration tab
6. **Monitor Logs**: View real-time logs with filtering in the Logs tab

### Connect Tab - One-Click Setup

The Connect tab provides the easiest way to integrate your MCP servers with various tools.

#### Option 1: Use the Buttons in the App
For each configured server, just click a button:
- **Connect to Claude Desktop** - Automatically configures claude_desktop_config.json
- **Start HTTP Gateway** - Launches HTTP server and shows the API endpoint
- **Connect to Cursor** - Currently use the CLI tool (see Option 2)

#### Option 2: Use the CLI Tool
After running `./install-global.sh`, you can use these commands from anywhere:
```bash
# List available servers
mcpd-setup list

# Setup for Claude Desktop
mcpd-setup filesystem --client claude

# Start HTTP Gateway (local access)
mcpd-setup filesystem --client http

# Create public tunnel (for external services like Railway)
mcpd-setup filesystem --client tunnel

# Setup for Cursor (with automatic tunnel)
mcpd-setup filesystem --client cursor
```

#### What Each Command Does

**Claude Desktop Integration:**
- Automatically configures `claude_desktop_config.json`
- Uses STDIO bridge for native MCP protocol support
- Creates individual server entries for clean organization
- Supports both unified (all servers) and per-server modes

**Cursor Integration:**
- Automatically creates a Cloudflare tunnel to bypass localhost restrictions
- Configures `~/.cursor/mcp.json` with the tunnel URL
- Starts HTTP gateway for MCP protocol translation
- Keeps the tunnel alive (terminal must stay open)
- Provides real-time access to MCP tools in Cursor

**Windsurf Integration:**
- Sets up Windsurf with MCP server access
- Optimized configuration for development workflows

**HTTP Gateway:**
- Starts HTTP server at `http://localhost:3001/partner/mcpd/{server}/mcp`
- Provides REST API access for web applications
- Compatible with Claude Code and other HTTP clients
- Automatic server discovery and routing
- CORS enabled for web app integration

**Public Tunnel (Cloudflare):**
- Creates a public URL for your MCP server
- No account or authentication required
- Perfect for Railway apps or external services
- Automatic cloudflared installation
- Example: `https://random-name.trycloudflare.com/partner/mcpd/{server}/mcp`

#### Example Workflows

**Setting up Claude Desktop:**
1. Go to Connect tab
2. Click "Copy" next to Claude command for your server
3. Paste and run in terminal
4. Restart Claude Desktop
5. Your MCP server is now available in Claude!

**Web Development with HTTP Gateway:**
1. Use the HTTP setup command
2. Access your server at `http://localhost:3001/partner/mcpd/filesystem/mcp`
3. Make MCP calls via HTTP POST requests
4. Perfect for integrating with web apps or API clients

### Advanced Integration Options

For manual setup or custom configurations, you can also integrate directly:

#### 1. Claude Desktop (Manual STDIO Bridge Setup)

The Connect tab automates this, but you can also manually add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpd-filesystem": {
      "command": "node",
      "args": ["/path/to/mcpd-bridge-server/dist/index.js"],
      "env": { 
        "MCPD_SERVER": "filesystem",
        "MCPD_URL": "http://localhost:8090" 
      }
    }
  }
}
```

#### 2. HTTP API Access (Manual Gateway)

Start the HTTP gateway manually:
```bash
cd mcpd-http-gateway
npm start
```

Then access via REST API:
```javascript
const response = await fetch('http://localhost:3001/partner/mcpd/filesystem/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "read_file",
      arguments: { path: "/tmp/test.txt" }
    }
  })
});
```

#### 3. Direct MCPD API

Connect directly to mcpd's HTTP API:
```javascript
const response = await fetch('http://localhost:8090/api/v1/servers/filesystem/tools/read_file', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: "/tmp/test.txt" })
});
```

## Architecture Overview

```
                    MCPD Daemon
                        ↓
    ┌───────────────────┼───────────────────┐
    ↓                   ↓                   ↓
Electron App      STDIO Bridge        HTTP Gateway
(Management)    (Claude Desktop)    (Web/API Access)
    ↓                   ↓                   ↓
Dashboard          MCP Protocol         REST API
Config Editor      Namespacing         WebSocket
Tool Explorer      Dual Modes          Authentication
```

## License

[Licensed](LICENSE) under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).