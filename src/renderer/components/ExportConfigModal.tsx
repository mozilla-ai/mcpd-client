import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Button,
  Space,
  Typography,
  Alert,
  message,
  Card,
  Divider,
  Radio,
  Input,
  Select,
  Checkbox,
} from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  CloudOutlined,
  DesktopOutlined,
  ApiOutlined,
  CloudServerOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import MonacoEditor from '@monaco-editor/react';

const { TabPane } = Tabs;
const { Title, Text, Paragraph } = Typography;

interface ExportConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

const ExportConfigModal: React.FC<ExportConfigModalProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState('claude-desktop');
  const [configContent, setConfigContent] = useState('');
  const [bridgeMode, setBridgeMode] = useState<'unified' | 'individual-bridge' | 'direct'>('unified');
  const [mcpdUrl, setMcpdUrl] = useState('http://localhost:8090');
  const [includeNamespacing, setIncludeNamespacing] = useState(true);
  
  useEffect(() => {
    if (visible) {
      generateConfig();
    }
  }, [visible, activeTab, bridgeMode, mcpdUrl, includeNamespacing]);

  const generateConfig = async () => {
    if (activeTab === 'mcp-http') {
      // Generate MCP-over-HTTP configuration examples
      const servers = await window.electronAPI.listServers();
      const serverExamples = servers.map(s => 
        `http://localhost:3001/partner/mcpd/${s.name}/mcp`
      ).slice(0, 3);
      
      const config = `# MCP-over-HTTP Configuration Examples

## For Cursor / Similar Tools
When these tools add MCP-over-HTTP support, configure them with:

### Option 1: All Servers (Unified)
\`\`\`json
{
  "mcp": {
    "servers": [{
      "name": "mcpd-gateway",
      "url": "http://localhost:3001/mcp"
    }]
  }
}
\`\`\`

### Option 2: Individual Servers
\`\`\`json
{
  "mcp": {
    "servers": [
${servers.slice(0, 3).map(s => `      {
        "name": "${s.name}",
        "url": "http://localhost:3001/partner/mcpd/${s.name}/mcp"
      }`).join(',\n')}
    ]
  }
}
\`\`\`

## Testing with curl

\`\`\`bash
# Initialize connection
curl -X POST http://localhost:3001/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:3001/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call a tool
curl -X POST http://localhost:3001/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"filesystem__read_file",
      "arguments":{"path":"/tmp/test.txt"}
    }
  }'
\`\`\`

## Available Server URLs
${serverExamples.map(url => `- ${url}`).join('\n')}
${servers.length > 3 ? `- ... and ${servers.length - 3} more servers` : ''}
`;
      
      setConfigContent(config);
    } else if (activeTab === 'claude-desktop') {
      if (bridgeMode === 'unified') {
        // Generate config for unified bridge mode (all servers)
        const config = {
          mcpServers: {
            'mcpd-all': {
              command: 'npx',
              args: ['mcpd-bridge-server'],
              env: {
                MCPD_URL: mcpdUrl,
              },
            },
          },
        };
        setConfigContent(JSON.stringify(config, null, 2));
      } else if (bridgeMode === 'individual-bridge') {
        // Generate individual bridge configs (one bridge per server)
        try {
          const servers = await window.electronAPI.listServers();
          const config: any = { mcpServers: {} };
          
          for (const server of servers) {
            const args = ['mcpd-bridge-server', '--server', server.name];
            if (!includeNamespacing) {
              args.push('--no-namespace');
            }
            
            config.mcpServers[`mcpd-${server.name}`] = {
              command: 'npx',
              args: args,
              env: {
                MCPD_URL: mcpdUrl,
              },
            };
          }
          
          setConfigContent(JSON.stringify(config, null, 2));
        } catch (error) {
          console.error('Failed to generate config:', error);
          message.error('Failed to generate configuration');
        }
      } else {
        // Generate direct server configs (no bridge)
        try {
          const servers = await window.electronAPI.listServers();
          const config: any = { mcpServers: {} };
          
          for (const server of servers) {
            // Parse the package string to determine runtime
            const [runtime, pkg] = server.package?.split('::') || ['npx', server.package];
            
            config.mcpServers[server.name] = {
              command: runtime || 'npx',
              args: [pkg || server.package],
            };
            
            // Add environment variables if any
            if (server.requiredEnv && server.requiredEnv.length > 0) {
              config.mcpServers[server.name].env = {};
              for (const envVar of server.requiredEnv) {
                config.mcpServers[server.name].env[envVar] = `<YOUR_${envVar}>`;
              }
            }
            
            // Add arguments if any
            if (server.requiredArgs && server.requiredArgs.length > 0) {
              config.mcpServers[server.name].args.push(...server.requiredArgs);
            }
          }
          
          setConfigContent(JSON.stringify(config, null, 2));
        } catch (error) {
          console.error('Failed to generate config:', error);
          message.error('Failed to generate configuration');
        }
      }
    } else if (activeTab === 'docker') {
      // Generate Docker Compose config
      const dockerCompose = `version: '3.8'

services:
  mcpd:
    image: mozilla/mcpd:latest
    ports:
      - "${mcpdUrl.split(':')[2] || '8090'}:8090"
    volumes:
      - ~/.config/mcpd:/root/.config/mcpd
    environment:
      - MCPD_LOG_LEVEL=info
    restart: unless-stopped

  mcpd-bridge:
    image: mcpd-bridge-server:latest
    depends_on:
      - mcpd
    environment:
      - MCPD_URL=http://mcpd:8090
    stdin_open: true
    tty: true
    restart: unless-stopped`;
      
      setConfigContent(dockerCompose);
    } else if (activeTab === 'api') {
      // Generate API usage examples
      const apiExamples = `# MCPD Access Methods

## 1. HTTP Gateway (Recommended for Web/API Access)

Start the HTTP gateway:
\`\`\`bash
npx mcpd-http-gateway
# Or with custom settings:
API_KEY=your-secure-key PORT=3000 npx mcpd-http-gateway
\`\`\`

### REST API Examples

List all servers:
\`\`\`bash
curl http://localhost:3000/api/servers \\
  -H "X-API-Key: default-dev-key"
\`\`\`

Call a tool:
\`\`\`bash
curl -X POST http://localhost:3000/api/tools/call \\
  -H "X-API-Key: default-dev-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "server": "filesystem",
    "tool": "read_file",
    "params": {"path": "/tmp/test.txt"}
  }'
\`\`\`

### JavaScript/TypeScript Client
\`\`\`javascript
const response = await fetch('http://localhost:3000/api/tools/call', {
  method: 'POST',
  headers: {
    'X-API-Key': 'default-dev-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    server: 'filesystem',
    tool: 'read_file',
    params: { path: '/tmp/test.txt' }
  })
});
const result = await response.json();
\`\`\`

### WebSocket Connection
\`\`\`javascript
const ws = new WebSocket('ws://localhost:3000/ws?apiKey=default-dev-key');

ws.send(JSON.stringify({
  type: 'tools.call',
  server: 'filesystem',
  tool: 'read_file',
  params: { path: '/tmp/test.txt' },
  id: 'req-123'
}));
\`\`\`

## 2. Direct MCPD API Access

Base URL: ${mcpdUrl}

List servers:
\`\`\`bash
curl ${mcpdUrl}/api/v1/servers
\`\`\`

Get server tools:
\`\`\`bash
curl ${mcpdUrl}/api/v1/servers/{server_name}/tools
\`\`\`

Call a tool:
\`\`\`bash
curl -X POST ${mcpdUrl}/api/v1/servers/{server_name}/tools/{tool_name}/call \\
  -H "Content-Type: application/json" \\
  -d '{"arguments": {}}'
\`\`\`

## 3. STDIO Bridge (for Claude Desktop)

Install and run:
\`\`\`bash
MCPD_URL=${mcpdUrl} npx mcpd-bridge-server
\`\`\``;
      
      setConfigContent(apiExamples);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(configContent);
    message.success('Configuration copied to clipboard');
  };

  const downloadConfig = () => {
    const blob = new Blob([configContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    let filename = 'config';
    if (activeTab === 'mcp-http') {
      filename = 'mcp-http-config.md';
    } else if (activeTab === 'claude-desktop') {
      filename = 'claude_desktop_config.json';
    } else if (activeTab === 'docker') {
      filename = 'docker-compose.yml';
    } else if (activeTab === 'api') {
      filename = 'api-examples.md';
    }
    
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`Configuration saved as ${filename}`);
  };

  return (
    <Modal
      title="Export Configuration"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="copy"
          icon={<CopyOutlined />}
          onClick={copyToClipboard}
        >
          Copy to Clipboard
        </Button>,
        <Button
          key="download"
          type="primary"
          icon={<DownloadOutlined />}
          onClick={downloadConfig}
        >
          Download
        </Button>,
      ]}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={
            <span>
              <GlobalOutlined />
              MCP-over-HTTP
            </span>
          } 
          key="mcp-http"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="MCP-over-HTTP Endpoint (Composio-style)"
              description={
                <div>
                  <p>This provides a direct HTTP endpoint that speaks the MCP protocol, similar to Composio's approach.</p>
                  <p>Tools like Cursor and Claude can connect directly to this URL (when they add HTTP support).</p>
                </div>
              }
              type="info"
              showIcon
            />
            
            <Card title="Quick Setup" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>1. Start the MCP-over-HTTP endpoint:</Text>
                  <Input.TextArea
                    value="npx mcpd-http-gateway start:mcp"
                    readOnly
                    autoSize
                    style={{ 
                      fontFamily: 'monospace',
                      marginTop: 8,
                      marginBottom: 16
                    }}
                  />
                </div>
                
                <Divider>For Cursor (when supported)</Divider>
                
                <div>
                  <Text strong>2. Run this setup command:</Text>
                  <Input.TextArea
                    value='npx @mcpd/setup "http://localhost:3001/mcp" --client cursor'
                    readOnly
                    autoSize
                    style={{ 
                      fontFamily: 'monospace',
                      fontSize: 12,
                      marginTop: 8,
                      marginBottom: 8
                    }}
                  />
                  <Text type="secondary">This would automatically configure Cursor with your MCPD endpoint</Text>
                </div>
                
                <Divider>Manual Configuration</Divider>
                
                <div>
                  <Text strong>Configure manually with these URLs:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">All servers (unified):</Text>
                    <Input value="http://localhost:3001/mcp" readOnly />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Specific server (example):</Text>
                    <Input value="http://localhost:3001/partner/mcpd/filesystem/mcp" readOnly />
                  </div>
                </div>
                
                <Divider />
                
                <Alert
                  message="Tool Support Status"
                  description={
                    <ul style={{ marginBottom: 0 }}>
                      <li>✅ Custom integrations (via MCP protocol)</li>
                      <li>⏳ Cursor - Check latest documentation</li>
                      <li>⏳ Claude - Planned HTTP support</li>
                      <li>⏳ Windsurf - Check their docs</li>
                    </ul>
                  }
                  type="warning"
                />
              </Space>
            </Card>
          </Space>
        </TabPane>
        <TabPane 
          tab={
            <span>
              <DesktopOutlined />
              Claude Desktop
            </span>
          } 
          key="claude-desktop"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="Claude Desktop Configuration"
              description="Copy this configuration to your Claude Desktop config file located at:"
              type="info"
              showIcon
              action={
                <Space direction="vertical" align="end">
                  <Text code>~/Library/Application Support/Claude/claude_desktop_config.json</Text>
                  <Text type="secondary">(macOS)</Text>
                  <Text code>%APPDATA%\Claude\claude_desktop_config.json</Text>
                  <Text type="secondary">(Windows)</Text>
                </Space>
              }
            />
            
            <Card size="small">
              <Radio.Group
                value={bridgeMode}
                onChange={(e) => setBridgeMode(e.target.value)}
                style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <Radio value="unified">
                  <Space direction="vertical" style={{ marginLeft: 24 }}>
                    <Space>
                      <ApiOutlined />
                      <strong>Unified Bridge</strong>
                      <Text type="secondary">(Recommended)</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Single connection exposing all servers with namespaced tools (e.g., github__create_issue)
                    </Text>
                  </Space>
                </Radio>
                <Radio value="individual-bridge">
                  <Space direction="vertical" style={{ marginLeft: 24 }}>
                    <Space>
                      <CloudOutlined />
                      <strong>Individual Bridges</strong>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Separate bridge connection for each server (better isolation, selective enabling)
                    </Text>
                  </Space>
                </Radio>
                <Radio value="direct">
                  <Space direction="vertical" style={{ marginLeft: 24 }}>
                    <Space>
                      <CloudServerOutlined />
                      <strong>Direct Connections</strong>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Connect directly to each MCP server without MCPD (requires manual config updates)
                    </Text>
                  </Space>
                </Radio>
              </Radio.Group>
              
              {(bridgeMode === 'unified' || bridgeMode === 'individual-bridge') && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text>MCPD URL:</Text>
                  <Input
                    value={mcpdUrl}
                    onChange={(e) => setMcpdUrl(e.target.value)}
                    placeholder="http://localhost:8090"
                  />
                  
                  {bridgeMode === 'individual-bridge' && (
                    <div style={{ marginTop: 12 }}>
                      <Checkbox
                        checked={includeNamespacing}
                        onChange={(e) => setIncludeNamespacing(e.target.checked)}
                      >
                        Include server prefix in tool names
                      </Checkbox>
                      <Text type="secondary" style={{ display: 'block', marginLeft: 24, fontSize: 12 }}>
                        {includeNamespacing 
                          ? 'Tools will be prefixed: filesystem__read_file'
                          : 'Tools will use original names: read_file'}
                      </Text>
                    </div>
                  )}
                  
                  <Alert
                    message={bridgeMode === 'unified' ? 'Unified Bridge Benefits' : 'Individual Bridge Benefits'}
                    description={
                      bridgeMode === 'unified' ? (
                        <ul style={{ marginBottom: 0, fontSize: 12 }}>
                          <li>Single configuration entry</li>
                          <li>All servers automatically available</li>
                          <li>Tools are namespaced to prevent conflicts</li>
                          <li>No config updates when adding servers</li>
                        </ul>
                      ) : (
                        <ul style={{ marginBottom: 0, fontSize: 12 }}>
                          <li>Better isolation between servers</li>
                          <li>Enable/disable servers individually</li>
                          <li>Optional tool namespacing</li>
                          <li>Easier debugging per server</li>
                        </ul>
                      )
                    }
                    type="info"
                  />
                </Space>
              )}
            </Card>
          </Space>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <CloudOutlined />
              Docker
            </span>
          } 
          key="docker"
        >
          <Alert
            message="Docker Deployment"
            description="Use this Docker Compose configuration to run MCPD and the bridge server in containers."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <ApiOutlined />
              API
            </span>
          } 
          key="api"
        >
          <Alert
            message="Direct API Access"
            description="Examples for accessing MCPD directly via HTTP API or using the bridge server programmatically."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </TabPane>
      </Tabs>
      
      <Divider>Configuration</Divider>
      
      <MonacoEditor
        height="400px"
        language={
          activeTab === 'claude-desktop' ? 'json' :
          activeTab === 'docker' ? 'yaml' :
          'markdown'
        }
        theme="vs-dark"
        value={configContent}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: 'on',
        }}
      />
    </Modal>
  );
};

export default ExportConfigModal;