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
  Checkbox,
} from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  CloudOutlined,
  DesktopOutlined,
  ApiOutlined,
  CloudServerOutlined,
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
  const [bridgeMode, setBridgeMode] = useState<'unified' | 'individual' | 'direct'>('unified');
  const [mcpdUrl, setMcpdUrl] = useState('http://localhost:8090');
  const [includeNamespacing, setIncludeNamespacing] = useState(true);

  useEffect(() => {
    if (visible) {
      generateConfig();
    }
  }, [visible, activeTab, bridgeMode, mcpdUrl, includeNamespacing]);

  const generateConfig = async () => {
    if (activeTab === 'claude-desktop') {
      if (bridgeMode === 'unified') {
        // Unified mcpd-proxy config (all servers via single proxy).
        const config = {
          mcpServers: {
            'mcpd': {
              command: 'npx',
              args: ['@mozilla-ai/mcpd-proxy'],
              env: {
                MCPD_ADDR: mcpdUrl,
              },
            },
          },
        };
        setConfigContent(JSON.stringify(config, null, 2));
      } else if (bridgeMode === 'individual') {
        // Individual mcpd-proxy configs (one per server).
        try {
          const servers = await window.electronAPI.listServers();
          const config: any = { mcpServers: {} };

          for (const server of servers) {
            config.mcpServers[`mcpd-${server.name}`] = {
              command: 'npx',
              args: ['@mozilla-ai/mcpd-proxy'],
              env: {
                MCPD_ADDR: mcpdUrl,
              },
            };
          }

          setConfigContent(JSON.stringify(config, null, 2));
        } catch (error) {
          console.error('Failed to generate config:', error);
          message.error('Failed to generate configuration');
        }
      } else {
        // Direct server configs (no proxy).
        try {
          const servers = await window.electronAPI.listServers();
          const config: any = { mcpServers: {} };

          for (const server of servers) {
            // Parse the package string to determine runtime.
            const [runtime, pkg] = server.package?.split('::') || ['npx', server.package];

            config.mcpServers[server.name] = {
              command: runtime || 'npx',
              args: [pkg || server.package],
            };

            if (server.requiredEnv && server.requiredEnv.length > 0) {
              config.mcpServers[server.name].env = {};
              for (const envVar of server.requiredEnv) {
                config.mcpServers[server.name].env[envVar] = `<YOUR_${envVar}>`;
              }
            }

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
    } else if (activeTab === 'api') {
      // Generate API usage examples using mcpd's built-in HTTP API.
      const apiExamples = `# mcpd Access Methods

## 1. mcpd HTTP API (Direct Access)

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

## 2. JavaScript/TypeScript SDK

Install the SDK:
\`\`\`bash
npm install @mozilla-ai/mcpd
\`\`\`

Usage:
\`\`\`javascript
import { McpdClient } from "@mozilla-ai/mcpd";

const client = new McpdClient({ apiEndpoint: "${mcpdUrl}" });

// List servers.
const servers = await client.listServers();

// Get tools for a server.
const tools = await client.servers.time.getTools();

// Call a tool.
const result = await client.servers.time.callTool("get_current_time", {
  timezone: "UTC"
});
\`\`\`

## 3. STDIO Proxy (for IDE Integrations)

For Claude Desktop, Cursor, and other IDEs that require STDIO-based MCP servers:
\`\`\`bash
npx @mozilla-ai/mcpd-proxy
\`\`\`

Set the mcpd address via environment variable:
\`\`\`bash
MCPD_ADDR=${mcpdUrl} npx @mozilla-ai/mcpd-proxy
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
    if (activeTab === 'claude-desktop') {
      filename = 'claude_desktop_config.json';
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
                      <strong>Unified Proxy</strong>
                      <Text type="secondary">(Recommended)</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Single mcpd-proxy connection exposing all servers with namespaced tools
                    </Text>
                  </Space>
                </Radio>
                <Radio value="individual">
                  <Space direction="vertical" style={{ marginLeft: 24 }}>
                    <Space>
                      <CloudOutlined />
                      <strong>Individual Proxies</strong>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Separate mcpd-proxy connection for each server (better isolation)
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
                      Connect directly to each MCP server without mcpd (requires manual config updates)
                    </Text>
                  </Space>
                </Radio>
              </Radio.Group>

              {(bridgeMode === 'unified' || bridgeMode === 'individual') && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text>mcpd URL:</Text>
                  <Input
                    value={mcpdUrl}
                    onChange={(e) => setMcpdUrl(e.target.value)}
                    placeholder="http://localhost:8090"
                  />

                  <Alert
                    message={bridgeMode === 'unified' ? 'Unified Proxy Benefits' : 'Individual Proxy Benefits'}
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
              <ApiOutlined />
              API
            </span>
          }
          key="api"
        >
          <Alert
            message="Direct API Access"
            description="Examples for accessing mcpd directly via HTTP API, the JavaScript SDK, or using mcpd-proxy for IDE integrations."
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
