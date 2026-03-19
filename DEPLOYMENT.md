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

## Security

mcpd's HTTP API has no built-in authentication. By default, it binds to `localhost:8090`, which limits access to the local machine. Do not expose port 8090 externally without first configuring authentication.

mcpd supports [authentication and authorization plugins](https://mozilla-ai.github.io/mcpd/plugin-configuration/) that run as external gRPC binaries. Configure them in `.mcpd.toml`:

```toml
[[plugins.authentication]]
name = "api-key-auth"
required = true
flows = ["request"]
```

See the [plugin documentation](https://mozilla-ai.github.io/mcpd/plugin-configuration/) and [plugin blog post](https://blog.mozilla.ai/mcpd-plugins-extend-your-agent-infrastructure-without-touching-your-code/) for available categories and SDKs.

## Quick Start Commands

```bash
# Local HTTP API (always available when mcpd is running)
curl http://localhost:8090/api/v1/servers

# IDE setup (STDIO via mcpd-proxy)
mcpd-setup filesystem --client claude
mcpd-setup filesystem --client cursor

```
