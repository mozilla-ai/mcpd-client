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
  Input,
  Alert,
  Divider,
} from 'antd';
import {
  CopyOutlined,
  RocketOutlined,
  GithubOutlined,
  CloudOutlined,
  CodeOutlined,
  CheckOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface ServerInfo {
  name: string;
  tools: string[];
}

const QuickSetup: React.FC = () => {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<'cursor' | 'claude' | 'windsurf' | 'http'>('cursor');
  const [loading, setLoading] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string>('');

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
      if (serversWithTools.length > 0 && !selectedServer) {
        setSelectedServer(serversWithTools[0].name);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    message.success('Command copied to clipboard!');
    
    // Reset the copied state after 3 seconds
    setTimeout(() => setCopiedCommand(''), 3000);
  };

  const getServerIcon = (name: string) => {
    if (name.includes('github')) return <GithubOutlined />;
    if (name.includes('filesystem')) return <CloudOutlined />;
    return <CodeOutlined />;
  };

  const getClientInfo = (client: string) => {
    const info = {
      cursor: {
        icon: '🖱️',
        name: 'Cursor',
        description: 'AI-powered code editor',
        status: 'Check latest docs for MCP support'
      },
      claude: {
        icon: '🤖',
        name: 'Claude Desktop',
        description: 'Desktop app with MCP support',
        status: 'Full STDIO bridge support'
      },
      windsurf: {
        icon: '🏄',
        name: 'Windsurf',
        description: 'AI-powered development environment',
        status: 'Check documentation for MCP support'
      },
      http: {
        icon: '🌐',
        name: 'HTTP API',
        description: 'Custom integrations via HTTP',
        status: 'Ready for any HTTP client'
      }
    };
    return info[client as keyof typeof info];
  };

  const getSetupCommand = () => {
    if (!selectedServer) return '';
    return `npx @mcpd/setup ${selectedServer} --client ${selectedClient}`;
  };

  const currentCommand = getSetupCommand();
  const isCommandCopied = copiedCommand === currentCommand;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RocketOutlined />
          Connect
        </Title>
        <Text type="secondary">
          Connect your MCP servers to Cursor, Claude Desktop, and other tools with a single command.
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card title="1. Choose MCP Server" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {servers.map((server) => (
                  <Button
                    key={server.name}
                    type={selectedServer === server.name ? 'primary' : 'default'}
                    icon={getServerIcon(server.name)}
                    onClick={() => setSelectedServer(server.name)}
                    style={{ marginBottom: 8 }}
                  >
                    {server.name}
                  </Button>
                ))}
              </div>

              {selectedServer && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>Available Tools:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      {servers
                        .find((s) => s.name === selectedServer)
                        ?.tools?.slice(0, 6)
                        .map((tool) => (
                          <Tag key={tool} color="blue" style={{ fontSize: 11 }}>
                            {tool}
                          </Tag>
                        ))}
                      {(servers.find((s) => s.name === selectedServer)?.tools?.length || 0) > 6 && (
                        <Tag style={{ fontSize: 11 }}>
                          +{(servers.find((s) => s.name === selectedServer)?.tools?.length || 0) - 6} more
                        </Tag>
                      )}
                    </Space>
                  </div>
                </div>
              )}
            </Space>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="2. Choose Target Application" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['cursor', 'claude', 'windsurf', 'http'] as const).map((client) => {
                  const clientInfo = getClientInfo(client);
                  return (
                    <Button
                      key={client}
                      type={selectedClient === client ? 'primary' : 'default'}
                      onClick={() => setSelectedClient(client)}
                      style={{ 
                        height: 'auto', 
                        padding: '8px 16px',
                        textAlign: 'left',
                        marginBottom: 8 
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 16, marginBottom: 4 }}>
                          {clientInfo.icon} {clientInfo.name}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {clientInfo.description}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>

              <Alert
                message={getClientInfo(selectedClient).status}
                type={selectedClient === 'claude' ? 'success' : 'info'}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {selectedServer && (
        <Card 
          title="3. Run Setup Command" 
          style={{ marginTop: 24 }}
          extra={
            <Button
              type="primary"
              icon={isCommandCopied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={() => copyCommand(currentCommand)}
              disabled={!currentCommand}
            >
              {isCommandCopied ? 'Copied!' : 'Copy'}
            </Button>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                Copy and paste this command into your terminal:
              </Text>
              <Input.TextArea
                value={currentCommand}
                readOnly
                autoSize
                style={{ 
                  fontFamily: 'monospace', 
                  fontSize: 16, 
                  fontWeight: 500,
                }}
              />
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                After running the command, restart {getClientInfo(selectedClient).name} to start using the MCP server.
              </Text>
            </div>

            {selectedClient === 'http' && (
              <Alert
                message="For HTTP integration"
                description="This command will start the HTTP gateway and provide you with the endpoint URL for custom integrations."
                type="info"
                showIcon
              />
            )}

            <Divider />

            <div>
              <Text strong>What this command does:</Text>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>✅ Checks that MCPD is running</li>
                <li>✅ Verifies the server exists and is available</li>
                <li>✅ Starts the HTTP gateway if needed</li>
                <li>✅ Automatically configures {getClientInfo(selectedClient).name}</li>
                <li>✅ No manual configuration required</li>
              </ul>
            </div>
          </Space>
        </Card>
      )}


      {servers.length === 0 && (
        <Card style={{ marginTop: 24 }}>
          <Alert
            message="No MCP servers found"
            description="Add some MCP servers first using the Servers tab, then come back here to set them up with your applications."
            type="warning"
            showIcon
          />
        </Card>
      )}
    </div>
  );
};

export default QuickSetup;