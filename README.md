# mcpd Client

A desktop app and CLI for managing MCP (Model Context Protocol) servers with Mozilla's [mcpd](https://github.com/mozilla-ai/mcpd). Integrates with Claude Desktop, Cursor, and other IDEs via [`@mozilla-ai/mcpd-proxy`](https://github.com/mozilla-ai/mcpd-proxy).

## CRITICAL SECURITY NOTICE

**Mozilla has NEVER published any packages from this project to npm.**

The following malicious packages have been confirmed on the public npm registry:

- `mcpd-bridge-server` - CONFIRMED MALICIOUS
- `mcpd-http-gateway` - CONFIRMED EXISTS (treat as malicious)
- `@mcpd/setup` - CONFIRMED EXISTS (treat as malicious)

If any other packages claiming to be from this project exist on npm, they should also be treated as malicious.

**Please be aware that Mozilla.ai will ONLY ever publish packages under the `@mozilla-ai/` namespace.**

## Core Components

### 1. **mcpd Client** (Electron App)

Visual desktop application for managing MCP servers with dashboard, configuration editor, and real-time monitoring.

### 2. **mcpd Setup CLI**

Command-line tool for quick setup of MCP servers with various clients (Claude, Cursor, Windsurf, HTTP).

## Features

- **Visual Server Management**: Add, remove, and monitor MCP servers through an intuitive UI
- **Tool Explorer**: Browse and test MCP tools with live execution
- **Configuration Editor**: Edit `.mcpd.toml` files with syntax highlighting
- **Real-time Logs**: Monitor daemon and server logs with filtering and search
- **Homebrew Integration**: Detect, install, and upgrade mcpd directly from the app
- **Dashboard**: Overview of system status, active servers, and available tools
- **Multiple Access Methods**:
  - STDIO via [`@mozilla-ai/mcpd-proxy`](https://github.com/mozilla-ai/mcpd-proxy) for IDE integrations (Claude Desktop, Cursor, etc.)
  - Direct mcpd HTTP API (default port 8090, configurable via `daemon.api.addr` in `.mcpd.toml`)
  - [`@mozilla-ai/mcpd`](https://github.com/mozilla-ai/mcpd-sdk-javascript) JavaScript/TypeScript SDK
  - Cloudflare Tunnels for external access (no account needed)
- **One-Click Client Setup**: Quick configuration for Claude, Cursor, and other MCP clients
- **Export Configurations**: Generate configs for various platforms and tools

## Prerequisites

- **[mcpd](https://github.com/mozilla-ai/mcpd)** — the MCP daemon (required):
  ```bash
  brew install mozilla-ai/tap/mcpd
  ```
- Node.js 18+ and npm
- npx (for JavaScript MCP servers)
- uvx (for Python MCP servers)

## Installation

```bash
# Clone the repository
git clone https://github.com/mozilla-ai/mcpd-client.git
cd mcpd-client

# Install dependencies
npm install

# Build the application
npm run build

# Install CLI tools globally (mcpd-setup)
./install-global.sh

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

- **Main Process**: Manages the mcpd daemon lifecycle, handles IPC, and system tray
- **Renderer Process**: React-based UI with Ant Design components
- **mcpd SDK**: Communicates with mcpd via the [`@mozilla-ai/mcpd`](https://github.com/mozilla-ai/mcpd-sdk-javascript) JavaScript SDK
- **IDE Integrations**: Uses [`@mozilla-ai/mcpd-proxy`](https://github.com/mozilla-ai/mcpd-proxy) for STDIO-based connections

```
                    mcpd Daemon (HTTP API)
                           |
         +-----------------+-----------------+
         |                 |                 |
    Electron App     mcpd-proxy         HTTP API
    (Management)   (IDE STDIO bridge)   (Direct access)
         |                 |                 |
    Dashboard         Claude Desktop    REST clients
    Config Editor     Cursor            SDK consumers
    Tool Explorer     VS Code
```

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **TypeScript**: Type safety
- **Ant Design**: UI component library
- **Monaco Editor**: Code editing for configurations
- **xterm.js**: Terminal emulator for logs
- **@mozilla-ai/mcpd**: JavaScript SDK for mcpd API

## Usage

### Using the Desktop Client

1. **Start the Daemon**: Click the power button in the header or use the system tray menu
2. **Add Servers**: Navigate to the Servers tab and click "Add Server"
3. **Quick Connect**: Use the Connect tab for one-click setup with Claude, Cursor, or HTTP API
4. **Explore Tools**: Use the Tools tab to browse and test available MCP tools
5. **Edit Configuration**: Modify `.mcpd.toml` directly in the Configuration tab
6. **Monitor Logs**: View real-time logs with filtering in the Logs tab

### Connect Tab - One-Click Setup

The Connect tab provides the easiest way to integrate your MCP servers with various tools.

For each configured server, click a button:

- **Connect to Claude Desktop** - Configures `claude_desktop_config.json` with mcpd-proxy
- **Connect to Cursor** - Configures `~/.cursor/mcp.json` with mcpd-proxy
- **HTTP API Info** - Shows the mcpd HTTP API endpoint

### CLI Tool

After running `./install-global.sh`, you can use these commands from anywhere:

```bash
# List available servers
mcpd-setup list

# Setup for Claude Desktop (configures mcpd-proxy)
mcpd-setup filesystem --client claude

# Setup for Cursor (configures mcpd-proxy)
mcpd-setup filesystem --client cursor

# Setup for Windsurf
mcpd-setup filesystem --client windsurf

# Show HTTP API info
mcpd-setup filesystem --client http

# Create public tunnel (for external services)
mcpd-setup filesystem --client tunnel
```

### Manual Integration

#### Claude Desktop / Cursor (STDIO via mcpd-proxy)

Add to `claude_desktop_config.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcpd": {
      "command": "npx",
      "args": ["@mozilla-ai/mcpd-proxy"],
      "env": {
        "MCPD_ADDR": "http://localhost:8090"
      }
    }
  }
}
```

#### JavaScript/TypeScript SDK

```bash
npm install @mozilla-ai/mcpd
```

```javascript
import { McpdClient } from "@mozilla-ai/mcpd";

const client = new McpdClient({ apiEndpoint: "http://localhost:8090" });

// List servers.
const servers = await client.listServers();

// Get tools for a server.
const tools = await client.servers.filesystem.getTools();

// Call a tool.
const result = await client.servers.filesystem.callTool("read_file", {
  path: "/tmp/test.txt",
});
```

#### Direct mcpd HTTP API

```bash
# List servers
curl http://localhost:8090/api/v1/servers

# Get server tools
curl http://localhost:8090/api/v1/servers/filesystem/tools

# Call a tool
curl -X POST http://localhost:8090/api/v1/servers/filesystem/tools/read_file/call \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"path": "/tmp/test.txt"}}'
```

## License

[Licensed](LICENSE) under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
