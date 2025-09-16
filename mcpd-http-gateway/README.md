# mcpd HTTP Gateway

Universal HTTP/HTTPS gateway for mcpd - expose MCP servers via REST API and WebSocket for use with Claude Code, Cursor, web apps, and any HTTP client.

## Features

- **REST API**: Full RESTful API for all MCP operations
- **WebSocket Support**: Real-time bidirectional communication
- **Authentication**: API key-based authentication
- **CORS Support**: Access from web applications
- **Rate Limiting**: Protect against abuse
- **SSL/TLS Ready**: Secure HTTPS connections
- **Universal Compatibility**: Works with any HTTP client

## Installation

```bash
npm install -g mcpd-http-gateway
```

Or run directly:
```bash
npx mcpd-http-gateway
```

## Quick Start

1. **Start mcpd daemon**:
   ```bash
   mcpd daemon
   ```

2. **Start the HTTP gateway**:
   ```bash
   mcpd-gateway
   ```

3. **Test the connection**:
   ```bash
   curl http://localhost:3000/api/servers \
     -H "X-API-Key: default-dev-key"
   ```

## API Endpoints

### Authentication
All endpoints require authentication via one of:
- `X-API-Key` header
- `Authorization: Bearer <key>` header
- `?apiKey=<key>` query parameter

### REST API

#### List all servers
```bash
GET /api/servers
```

#### Get specific server
```bash
GET /api/servers/:name
```

#### Get server tools
```bash
GET /api/servers/:name/tools
```

#### List all tools (across all servers)
```bash
GET /api/tools
```

#### Call a tool
```bash
POST /api/tools/call
Body: {
  "server": "filesystem",
  "tool": "read_file",
  "params": {
    "path": "/tmp/test.txt"
  }
}
```

#### Direct tool call
```bash
POST /api/servers/:server/tools/:tool/call
Body: {
  "path": "/tmp/test.txt"
}
```

### WebSocket API

Connect to `ws://localhost:3000/ws?apiKey=your-key`

Message format:
```json
{
  "type": "tools.call",
  "server": "filesystem",
  "tool": "read_file",
  "params": { "path": "/tmp/test.txt" },
  "id": "unique-request-id"
}
```

## Configuration

### Environment Variables

- `PORT`: HTTP server port (default: 3000)
- `MCPD_URL`: mcpd daemon API URL (default: http://localhost:8090)
- `API_KEY`: API key for authentication (default: default-dev-key)
- `ENABLE_CORS`: Enable CORS headers (default: true)
- `SSL_CERT`: Path to SSL certificate for HTTPS
- `SSL_KEY`: Path to SSL private key for HTTPS

### Example .env file
```env
PORT=3000
MCPD_URL=http://localhost:8090
API_KEY=your-secure-api-key
ENABLE_CORS=true
```

## Integration Examples

### Claude Code / Cursor

If these tools support HTTP-based MCP servers, configure them like:

```json
{
  "mcp.servers": {
    "mcpd-gateway": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "X-API-Key": "your-api-key",
        "X-MCP-Server": "filesystem"
      }
    }
  }
}
```

### JavaScript/TypeScript Client

```javascript
// List all tools
const response = await fetch('http://localhost:3000/api/tools', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});
const { tools } = await response.json();

// Call a tool
const result = await fetch('http://localhost:3000/api/tools/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    server: 'filesystem',
    tool: 'read_file',
    params: { path: '/tmp/test.txt' }
  })
});
```

### Python Client

```python
import requests

# List servers
response = requests.get(
    'http://localhost:3000/api/servers',
    headers={'X-API-Key': 'your-api-key'}
)
servers = response.json()

# Call a tool
response = requests.post(
    'http://localhost:3000/api/tools/call',
    headers={'X-API-Key': 'your-api-key'},
    json={
        'server': 'github',
        'tool': 'create_issue',
        'params': {
            'title': 'New Issue',
            'body': 'Issue description'
        }
    }
)
result = response.json()
```

### WebSocket Client

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?apiKey=your-api-key');

ws.on('open', () => {
  // Call a tool
  ws.send(JSON.stringify({
    type: 'tools.call',
    server: 'filesystem',
    tool: 'read_file',
    params: { path: '/tmp/test.txt' },
    id: '123'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.id === '123') {
    console.log('Tool result:', response.data);
  }
});
```

## Security Considerations

1. **Change the default API key** in production
2. **Use HTTPS** with SSL certificates for production
3. **Configure rate limiting** based on your needs
4. **Restrict CORS origins** in production
5. **Use environment variables** for sensitive configuration
6. **Run behind a reverse proxy** (nginx, caddy) for additional security

## Architecture

```
HTTP Clients (Claude Code, Cursor, Web Apps, CLI tools)
                    ↓
            HTTP/WebSocket API
                    ↓
            mcpd HTTP Gateway
                    ↓
              HTTP API Calls
                    ↓
              mcpd Daemon
                    ↓
          Individual MCP Servers
```

## Comparison with STDIO Bridge

| Feature | HTTP Gateway | STDIO Bridge |
|---------|-------------|--------------|
| **Protocol** | HTTP/WebSocket | STDIO/MCP |
| **Remote Access** | ✅ Yes | ❌ No |
| **Web Compatible** | ✅ Yes | ❌ No |
| **Authentication** | ✅ API Keys | ❌ None |
| **Rate Limiting** | ✅ Yes | ❌ No |
| **CORS Support** | ✅ Yes | N/A |
| **Claude Desktop** | ❌ No* | ✅ Yes |
| **Universal Access** | ✅ Yes | ❌ No |

*Claude Desktop currently only supports STDIO-based MCP servers

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT