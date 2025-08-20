# MCP-over-HTTP Setup Guide

This guide shows how to use the MCP-over-HTTP endpoint (similar to Composio's approach) to connect Cursor, Claude, and other tools directly to your MCPD servers.

## How It Works

Instead of using STDIO (which requires local process spawning), this endpoint makes your MCP servers available via HTTP URLs that tools can connect to directly:

```
Cursor/Claude → HTTP → MCP Endpoint → MCPD → Your MCP Servers
```

## Quick Start

### 1. Start the MCP-over-HTTP Endpoint

```bash
# Start MCPD first
mcpd start

# Then start the MCP endpoint
npm run start:mcp
# Or
npx tsx src/mcp-http-endpoint.ts
```

This will start the endpoint at `http://localhost:3001/mcp`

### 2. Configure Your Tools

## For Cursor

If Cursor supports MCP-over-HTTP (check their latest documentation), you would configure it like:

```json
{
  "mcp": {
    "servers": [
      {
        "name": "mcpd-gateway",
        "url": "http://localhost:3001/mcp"
      }
    ]
  }
}
```

Or for a specific server:
```json
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "url": "http://localhost:3001/partner/mcpd/filesystem/mcp"
      }
    ]
  }
}
```

## For Claude (if HTTP support is added)

Similar configuration would apply for Claude Desktop if they add HTTP endpoint support.

## For Custom Integrations

You can send MCP protocol messages directly:

```javascript
// Initialize connection
const response = await fetch('http://localhost:3001/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '1.0.0',
      capabilities: {}
    }
  })
});

// List tools
const toolsResponse = await fetch('http://localhost:3001/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  })
});

// Call a tool
const callResponse = await fetch('http://localhost:3001/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'filesystem__read_file',
      arguments: { path: '/tmp/test.txt' }
    }
  })
});
```

## URL Patterns

### All Servers (Unified)
```
http://localhost:3001/mcp
```
- All tools are namespaced: `server__tool`
- Single endpoint for all servers

### Specific Server
```
http://localhost:3001/partner/mcpd/{server}/mcp
```
- Replace `{server}` with your server name (e.g., `filesystem`, `github`)
- Tools are not namespaced
- Isolated access to single server

## Testing the Endpoint

Test with curl:

```bash
# Initialize
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call a tool
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"filesystem__read_file",
      "arguments":{"path":"/tmp/test.txt"}
    }
  }'
```

## Advantages of This Approach

1. **Direct Integration**: Tools connect directly via HTTP, no local process needed
2. **Remote Access**: Can be hosted on a server and accessed from anywhere
3. **Standard Protocol**: Uses the actual MCP protocol over HTTP
4. **Flexible Routing**: Support both unified and per-server endpoints
5. **Cloud-Ready**: Can be deployed to cloud services like Vercel, Railway, etc.

## Deployment Options

### Local Development
```bash
npm run dev:mcp
```

### Production (Local)
```bash
npm run build
npm run start:mcp
```

### Cloud Deployment
Deploy to any service that supports Node.js:
- Vercel
- Railway
- Heroku
- AWS Lambda (with adapter)
- Google Cloud Run

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start:mcp"]
```

## Security Considerations

For production use:
1. Add authentication (API keys, OAuth)
2. Use HTTPS with SSL certificates
3. Implement rate limiting
4. Add CORS restrictions
5. Use environment variables for sensitive config

## Comparison with Other Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **MCP-over-HTTP** (This) | Direct tool integration, Remote access, Cloud deployable | Tools need HTTP support |
| **STDIO Bridge** | Native Claude Desktop support | Local only, Complex setup |
| **REST API Gateway** | Universal access, Any HTTP client | Not MCP protocol, Custom integration needed |

## Current Tool Support

- **Cursor**: ⚠️ Check latest docs for MCP-over-HTTP support
- **Claude Desktop**: ❌ Currently STDIO only
- **Windsurf**: ⚠️ Check their documentation
- **Custom Tools**: ✅ Can integrate via HTTP