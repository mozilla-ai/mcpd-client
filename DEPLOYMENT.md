# Deployment Guide for mcpd Client

## Prerequisites

mcpd must be installed via Homebrew:

```bash
brew install mozilla-ai/tap/mcpd
```

## Accessing MCP Servers

mcpd exposes an HTTP API on port 8090 by default (configurable via `daemon.api.addr` in `.mcpd.toml`). There is no need for a separate gateway process.

### Local Access

The mcpd daemon provides a built-in HTTP API:

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

Or use the JavaScript SDK:

```bash
npm install @mozilla-ai/mcpd
```

```javascript
import { McpdClient } from "@mozilla-ai/mcpd";

const client = new McpdClient({ apiEndpoint: "http://localhost:8090" });
const result = await client.servers.filesystem.callTool("read_file", {
  path: "/tmp/test.txt",
});
```

### IDE Integrations (STDIO)

For Claude Desktop, Cursor, and other IDEs that require STDIO-based MCP servers, use mcpd-proxy:

```bash
npx @mozilla-ai/mcpd-proxy
```

Or use the setup CLI:

```bash
mcpd-setup filesystem --client claude
mcpd-setup filesystem --client cursor
```

## Exposing to External Services

When you need to connect external services to your local mcpd instance, you can tunnel the mcpd HTTP API directly.

### Option 1: ngrok (Requires Account)

```bash
# Sign up at https://ngrok.com and authenticate
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Create tunnel to mcpd
ngrok http 8090
```

### Option 2: localtunnel (Simple & Free)

```bash
npx localtunnel --port 8090
```

## Example: Connecting External App to Local mcpd

```javascript
const MCPD_URL = process.env.MCPD_URL || "https://your-tunnel-url.example.com";

async function callMCPTool(server, toolName, args) {
  const response = await fetch(
    `${MCPD_URL}/api/v1/servers/${server}/tools/${toolName}/call`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arguments: args }),
    },
  );

  return response.json();
}

// Example usage.
const result = await callMCPTool("filesystem", "read_file", {
  path: "/tmp/data.txt",
});
```

## Security Considerations

When exposing local services:

1. **Use HTTPS** tunnels only
2. **Restrict access** using mcpd's auth plugin support
3. **Monitor usage** to prevent abuse
4. **Consider deploying** mcpd to the cloud instead of tunneling

## Quick Start Commands

```bash
# Local HTTP API (always available when mcpd is running)
curl http://localhost:8090/api/v1/servers

# IDE setup (STDIO via mcpd-proxy)
mcpd-setup filesystem --client claude
mcpd-setup filesystem --client cursor

```
