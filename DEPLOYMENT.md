# Deployment Guide for mcpd Client

## Exposing Local MCP Servers to External Services

When you need to connect your local MCP servers to external services (like a Railway app), you have several options:

### Option 1: Using Cloudflare Tunnel (Recommended - Free, No Account)

**One command setup:**
```bash
mcpd-setup filesystem --client tunnel
```

This will:
- Automatically install cloudflared if not present
- Start the HTTP gateway
- Create a public tunnel
- Display the public URL for your Railway app

Example output:
```
✅ Your MCP server is now accessible from anywhere!

🌍 Public URL: https://random-name.trycloudflare.com/partner/mcpd/filesystem/mcp
```

### Option 2: Using ngrok (Requires Account)

1. **Install ngrok and authenticate:**
```bash
# Sign up at https://ngrok.com
# Then authenticate:
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

2. **Start the HTTP gateway:**
```bash
mcpd-setup filesystem --client http
```

3. **Create ngrok tunnel:**
```bash
ngrok http 3001
```

4. **Use the ngrok URL in your Railway app:**
```
https://abc123.ngrok.io/partner/mcpd/filesystem/mcp
```

### Option 3: Using localtunnel (Simple & Free)

1. **Install and run localtunnel:**
```bash
npx localtunnel --port 3001
```

2. **Use the provided URL:**
```
https://random-name.loca.lt/partner/mcpd/filesystem/mcp
```

### Option 4: Deploy the Gateway to Railway

Instead of tunneling, you could deploy the HTTP gateway itself to Railway:

1. **Create a new Railway project**

2. **Deploy the gateway:**
```bash
cd mcpd-http-gateway
railway init
railway up
```

3. **Set environment variables in Railway:**
```
MCPD_URL=http://your-local-ip:8090
PORT=3001
```

4. **Use Railway's public URL:**
```
https://your-app.railway.app/partner/mcpd/filesystem/mcp
```

## Example: Connecting Railway App to Local MCP

### In your Railway app code:
```javascript
const MCP_ENDPOINT = process.env.MCP_ENDPOINT || 'https://your-tunnel.ngrok.io/partner/mcpd/filesystem/mcp';

async function callMCPTool(toolName, args) {
  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  });
  
  return response.json();
}

// Example usage
const result = await callMCPTool('read_file', { path: '/tmp/data.txt' });
```

## Security Considerations

When exposing local services:

1. **Add authentication** to the HTTP gateway (modify the API key in the code)
2. **Use HTTPS** tunnels only
3. **Restrict CORS** origins in production
4. **Monitor usage** to prevent abuse
5. **Consider deploying** the gateway to the cloud instead of tunneling

## Quick Start Commands

```bash
# Local only
mcpd-setup filesystem --client http

# With Cloudflare Tunnel (simplest - no account needed)
mcpd-setup filesystem --client tunnel

# With ngrok (requires account)
ngrok http 3001

# With localtunnel
npx localtunnel --port 3001
```

The URL pattern is always:
```
https://YOUR-TUNNEL-DOMAIN/partner/mcpd/[server-name]/mcp
```

Replace `[server-name]` with your actual server (e.g., `filesystem`, `github`, etc.)