import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Typography,
  Button,
  message,
  Tag,
  Alert,
  Divider,
  Modal,
  Input,
} from 'antd';
import {
  RocketOutlined,
  CloudOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  ApiOutlined,
  DesktopOutlined,
  GlobalOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;

interface ServerInfo {
  name: string;
  tools: string[];
}

const QuickSetup: React.FC = () => {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState<string>('');
  const [httpUrl, setHttpUrl] = useState<string>('');

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    setLoading(true);
    try {
      const serverList = await window.electronAPI.listServers();
      
      // Fetch tools for each server
      const serversWithTools = await Promise.all(
        serverList.map(async (server: any) => {
          try {
            const tools = await window.electronAPI.getServerTools(server.name);
            return {
              ...server,
              tools: tools.map((t: any) => t.name || t),
            };
          } catch (error) {
            console.error(`Failed to load tools for ${server.name}:`, error);
            return {
              ...server,
              tools: [],
            };
          }
        })
      );
      
      setServers(serversWithTools);
    } catch (error) {
      console.error('Failed to load servers:', error);
      message.error('Failed to load servers. Make sure the daemon is running.');
    } finally {
      setLoading(false);
    }
  };

  const setupClaude = async (serverName: string) => {
    setSetupLoading(`claude-${serverName}`);
    try {
      const result = await window.electronAPI.setupClaude(serverName);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error('Failed to setup Claude Desktop');
      }
    } catch (error) {
      console.error('Failed to setup Claude:', error);
      message.error('Failed to setup Claude Desktop');
    } finally {
      setSetupLoading('');
    }
  };

  const setupHTTP = async (serverName: string) => {
    setSetupLoading(`http-${serverName}`);
    try {
      const result = await window.electronAPI.setupHTTP(serverName);
      if (result.success) {
        setHttpUrl(result.url || '');
        Modal.success({
          title: 'HTTP Gateway Started',
          content: (
            <div>
              <Paragraph>{result.message}</Paragraph>
              <Input.TextArea 
                value={result.url}
                readOnly
                autoSize
                style={{ marginTop: 12 }}
              />
              <Paragraph style={{ marginTop: 12 }}>
                <Text strong>Example usage:</Text>
              </Paragraph>
              <Input.TextArea
                value={`curl -X POST ${result.url} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
                readOnly
                autoSize={{ minRows: 3 }}
              />
            </div>
          ),
          width: 600,
        });
      }
    } catch (error) {
      console.error('Failed to setup HTTP:', error);
      message.error('Failed to start HTTP gateway');
    } finally {
      setSetupLoading('');
    }
  };

  const setupCursor = async (serverName: string) => {
    setSetupLoading(`cursor-${serverName}`);
    try {
      const result = await window.electronAPI.setupCursor(serverName);
      message.info(result.message);
    } catch (error) {
      console.error('Failed to setup Cursor:', error);
      message.error('Failed to setup Cursor');
    } finally {
      setSetupLoading('');
    }
  };

  const getServerIcon = (name: string) => {
    if (name.includes('filesystem')) return <CloudOutlined />;
    return <CodeOutlined />;
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RocketOutlined />
          Connect
        </Title>
        <Text type="secondary">
          One-click setup for your MCP servers. Just click a button to connect!
        </Text>
      </div>

      {servers.length === 0 && !loading && (
        <Alert
          message="No servers found"
          description="Make sure the mcpd daemon is running and you have servers configured."
          type="warning"
          showIcon
          action={
            <Button size="small" onClick={loadServers}>
              Refresh
            </Button>
          }
        />
      )}

      {loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingOutlined style={{ fontSize: 24 }} />
            <div style={{ marginTop: 16 }}>Loading servers...</div>
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {servers.map((server) => (
            <Col span={24} key={server.name}>
              <Card>
                <Row gutter={[16, 16]} align="middle">
                  <Col span={6}>
                    <Space>
                      {getServerIcon(server.name)}
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          {server.name}
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {server.tools.length} tools available
                          </Text>
                        </div>
                      </div>
                    </Space>
                  </Col>
                  
                  <Col span={18}>
                    <Space size="middle" wrap>
                      <Button
                        type="primary"
                        icon={<DesktopOutlined />}
                        onClick={() => setupClaude(server.name)}
                        loading={setupLoading === `claude-${server.name}`}
                      >
                        Connect to Claude Desktop
                      </Button>
                      
                      <Button
                        icon={<GlobalOutlined />}
                        onClick={() => setupHTTP(server.name)}
                        loading={setupLoading === `http-${server.name}`}
                      >
                        Start HTTP Gateway
                      </Button>
                      
                      <Button
                        icon={<ApiOutlined />}
                        onClick={() => setupCursor(server.name)}
                        loading={setupLoading === `cursor-${server.name}`}
                        disabled
                      >
                        Connect to Cursor (Coming Soon)
                      </Button>
                    </Space>
                  </Col>
                </Row>
                
                {server.tools.length > 0 && (
                  <>
                    <Divider style={{ margin: '16px 0 8px' }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Available tools: </Text>
                      <Space wrap style={{ marginTop: 4 }}>
                        {server.tools.slice(0, 8).map((tool) => (
                          <Tag key={tool} style={{ fontSize: 11 }}>
                            {tool}
                          </Tag>
                        ))}
                        {server.tools.length > 8 && (
                          <Tag style={{ fontSize: 11 }}>
                            +{server.tools.length - 8} more
                          </Tag>
                        )}
                      </Space>
                    </div>
                  </>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <div style={{ marginTop: 32 }}>
        <Card size="small">
          <Title level={4}>How it works</Title>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <div>
                  <Text strong>Claude Desktop</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Automatically configures claude_desktop_config.json
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <div>
                  <Text strong>HTTP Gateway</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Starts a local HTTP server for API access
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <CheckCircleOutlined style={{ color: '#faad14' }} />
                <div>
                  <Text strong>Cursor</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Integration coming soon
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  );
};

export default QuickSetup;