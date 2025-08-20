import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Space,
  Typography,
  Button,
  message,
  Card,
  Tag,
  Input,
  List,
  Alert,
} from 'antd';
import {
  CopyOutlined,
  RocketOutlined,
  GithubOutlined,
  CloudOutlined,
  CodeOutlined,
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { Text, Title } = Typography;

interface SimpleExportModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ServerInfo {
  name: string;
  tools: string[];
}

const SimpleExportModal: React.FC<SimpleExportModalProps> = ({ visible, onClose }) => {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadServers();
    }
  }, [visible]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const serverList = await window.electronAPI.listServers();
      setServers(serverList);
      if (serverList.length > 0 && !selectedServer) {
        setSelectedServer(serverList[0].name);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    message.success('Command copied to clipboard!');
  };

  const getServerIcon = (name: string) => {
    if (name.includes('github')) return <GithubOutlined />;
    if (name.includes('filesystem')) return <CloudOutlined />;
    return <CodeOutlined />;
  };

  return (
    <Modal
      title={
        <Space>
          <RocketOutlined />
          <span>Quick Setup</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Server Selection */}
        <div>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>
            Select MCP Server to Install:
          </Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {servers.map((server) => (
              <Button
                key={server.name}
                type={selectedServer === server.name ? 'primary' : 'default'}
                icon={getServerIcon(server.name)}
                onClick={() => setSelectedServer(server.name)}
              >
                {server.name}
              </Button>
            ))}
          </div>
        </div>

        {selectedServer && (
          <>
            {/* Installation Tabs */}
            <Tabs defaultActiveKey="cursor">
              <TabPane
                tab={
                  <Space>
                    <span style={{ fontSize: 20 }}>🖱️</span>
                    <span>Cursor</span>
                  </Space>
                }
                key="cursor"
              >
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">
                      Paste and run this command in your terminal to set up Cursor with MCP
                    </Text>
                    <div style={{ position: 'relative' }}>
                      <Input.TextArea
                        value={`npx @mcpd/setup ${selectedServer} --client cursor`}
                        readOnly
                        autoSize
                        style={{ fontFamily: 'monospace', fontSize: 14, paddingRight: 40 }}
                      />
                      <Button
                        icon={<CopyOutlined />}
                        size="small"
                        style={{ position: 'absolute', right: 4, top: 4 }}
                        onClick={() => copyCommand(`npx @mcpd/setup ${selectedServer} --client cursor`)}
                      />
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      After running the command, restart Cursor to start using the MCP Server.
                    </Text>
                  </Space>
                </Card>
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <span style={{ fontSize: 20 }}>🤖</span>
                    <span>Claude</span>
                  </Space>
                }
                key="claude"
              >
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">
                      For Claude Desktop, use the STDIO bridge:
                    </Text>
                    <Input.TextArea
                      value={`npx @mcpd/setup ${selectedServer} --client claude`}
                      readOnly
                      autoSize
                      style={{ fontFamily: 'monospace', fontSize: 14 }}
                    />
                    <Alert
                      message="Note"
                      description="Claude Desktop uses a different protocol. This command will configure the STDIO bridge."
                      type="info"
                      showIcon
                    />
                  </Space>
                </Card>
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <span style={{ fontSize: 20 }}>🏄</span>
                    <span>Windsurf</span>
                  </Space>
                }
                key="windsurf"
              >
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">
                      Set up Windsurf with this command:
                    </Text>
                    <Input.TextArea
                      value={`npx @mcpd/setup ${selectedServer} --client windsurf`}
                      readOnly
                      autoSize
                      style={{ fontFamily: 'monospace', fontSize: 14 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Check Windsurf documentation for MCP support status.
                    </Text>
                  </Space>
                </Card>
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <span style={{ fontSize: 20 }}>🌐</span>
                    <span>HTTP API</span>
                  </Space>
                }
                key="http"
              >
                <Card>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">
                      For custom integrations, run this setup command:
                    </Text>
                    <Input.TextArea
                      value={`npx @mcpd/setup ${selectedServer} --client http`}
                      readOnly
                      autoSize
                      style={{ fontFamily: 'monospace', fontSize: 14 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      This will start the HTTP gateway and provide you with:
                    </Text>
                    <div style={{ 
                      background: 'rgba(0,0,0,0.05)', 
                      padding: 8, 
                      borderRadius: 4,
                      marginTop: 8 
                    }}>
                      <code style={{ fontSize: 12 }}>
                        http://localhost:3001/partner/mcpd/{selectedServer}/mcp
                      </code>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      Use this URL in your application's HTTP client.
                    </Text>
                  </Space>
                </Card>
              </TabPane>
            </Tabs>

            {/* Tools Preview */}
            <Card title="Available Tools" size="small">
              <Space wrap>
                {(() => {
                  const server = servers.find((s) => s.name === selectedServer);
                  if (!server || !server.tools) return null;
                  
                  return (
                    <>
                      {server.tools.slice(0, 6).map((tool) => (
                        <Tag key={tool} color="blue">
                          {tool}
                        </Tag>
                      ))}
                      {server.tools.length > 6 && (
                        <Tag>+{server.tools.length - 6} more</Tag>
                      )}
                    </>
                  );
                })()}
              </Space>
            </Card>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default SimpleExportModal;