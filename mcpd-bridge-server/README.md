# mcpd Bridge Server

A universal MCP bridge that connects to the mcpd daemon and exposes MCP servers in two modes: unified (all servers) or individual (per-server). This allows any MCP client (Claude Desktop, Claude.ai, etc.) to access your mcpd-managed servers with flexible configuration options.

## ⚠️ Security Notice

**DO NOT** install `mcpd-bridge-server` from npm. A confirmed malicious package has been published under this name. Mozilla has never published this package to npm. This package is part of the mcpd-client monorepo and should only be installed from source.

**Please be aware that Mozilla.ai will ONLY ever publish packages under the `@mozilla-ai/` namespace.**

## Features

- **Dual Mode Operation**:
  - **Unified Mode**: Single connection exposing all servers
  - **Individual Mode**: Separate connection per server for better isolation
- **Flexible Tool Namespacing**:
  - Always enabled in unified mode (e.g., `github__create_issue`)
  - Optional in individual mode with `--no-namespace` flag
- **Dynamic Discovery**: Automatically discovers servers and tools from mcpd
- **Standard MCP Protocol**: Works with any MCP-compatible client

## Installation

This package is part of the mcpd-client monorepo. Install from the repository root:

```bash
# From the repository root
npm install

# Build the bridge server
cd mcpd-bridge-server
npm run build

# Install the mcpd-bridge command globally from source
cd ..
./install-global.sh
```

**Note:** You must run `./install-global.sh` to install the `mcpd-bridge` command globally before using it in Claude Desktop or other MCP clients.

## Usage

### Command Line Options

```bash
mcpd-bridge-server [options]

Options:
  --server, -s <name>  Proxy only the specified server (individual mode)
  --no-namespace       Disable tool namespacing in individual mode
  --help, -h           Show help message

Examples:
  # Unified mode - all servers with namespaced tools
  mcpd-bridge-server

  # Individual mode - only filesystem server with namespacing
  mcpd-bridge-server --server filesystem

  # Individual mode - GitHub server without namespacing
  mcpd-bridge-server --server github --no-namespace
```

### Configuration Examples

#### 1. Unified Mode (All Servers)

Single connection exposing all mcpd servers:

```json
{
  "mcpServers": {
    "mcpd-all": {
      "command": "mcpd-bridge",
      "args": [],
      "env": {
        "MCPD_URL": "http://localhost:8090"
      }
    }
  }
}
```

Tools will be namespaced: `filesystem__read_file`, `github__create_issue`, etc.

#### 2. Individual Mode (Per Server)

Separate connections for each server:

```json
{
  "mcpServers": {
    "mcpd-filesystem": {
      "command": "mcpd-bridge",
      "args": ["--server", "filesystem"],
      "env": {
        "MCPD_URL": "http://localhost:8090"
      }
    },
    "mcpd-github": {
      "command": "mcpd-bridge",
      "args": ["--server", "github", "--no-namespace"],
      "env": {
        "MCPD_URL": "http://localhost:8090"
      }
    }
  }
}
```

#### 3. Mixed Configuration

You can combine both modes for maximum flexibility:

```json
{
  "mcpServers": {
    // Critical servers individually for better control
    "mcpd-filesystem": {
      "command": "mcpd-bridge",
      "args": ["--server", "filesystem"],
      "env": { "MCPD_URL": "http://localhost:8090" }
    },
    // All other servers through unified bridge
    "mcpd-others": {
      "command": "mcpd-bridge",
      "args": [],
      "env": { "MCPD_URL": "http://localhost:8090" }
    }
  }
}
```

## Configuration

The bridge server can be configured through environment variables:

- `MCPD_URL`: URL of the mcpd daemon (default: `http://localhost:8090`)
- `MCPD_API_KEY`: Optional API key for mcpd authentication

## How It Works

### Unified Mode
1. Bridge connects to mcpd and discovers ALL servers
2. Tools from all servers are exposed with namespacing (`server__tool`)
3. Single MCP connection handles all servers
4. Best for: Simple setup, automatic discovery of new servers

### Individual Mode
1. Bridge connects to mcpd for a specific server only
2. Tools can be namespaced or use original names
3. Each server requires its own bridge instance
4. Best for: Server isolation, selective enabling, debugging

### Request Flow
```
Claude Desktop → MCP Protocol → Bridge Server → HTTP API → mcpd → Target MCP Server
```

## Architecture

```
Claude Desktop / Claude.ai
         ↓
   MCP Protocol
         ↓
  mcpd Bridge Server
         ↓
    HTTP API
         ↓
    mcpd Daemon
         ↓
  Individual MCP Servers
  (filesystem, github, etc.)
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## License

MIT