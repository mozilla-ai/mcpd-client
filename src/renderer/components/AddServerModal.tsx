import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tabs,
  Tag,
  Alert,
  Checkbox,
  Divider,
  List,
  Typography,
  Spin,
  message,
  Card,
  Row,
  Col,
  Collapse,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  CodeOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  CloudOutlined,
  GithubOutlined,
  MessageOutlined,
  FileOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import MonacoEditor from '@monaco-editor/react';
import { MCP_SERVERS, MCPServerTemplate, getServersByCategory, searchServers } from '../data/mcp-servers';

const { TextArea } = Input;
const { Text, Paragraph, Title } = Typography;
const { TabPane } = Tabs;

interface AddServerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RegistryServer {
  id: string;
  name: string;
  description?: string;
  license?: string;
  official?: boolean;
  categories?: string[];
  tags?: string[];
  runtimes?: Array<{
    runtime: string;
    package: string;
    version: string;
  }>;
  tools?: string[];
  environmentVariables?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  requiredArgs?: string[];
}

const AddServerModal: React.FC<AddServerModalProps> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [mode, setMode] = useState<'browse' | 'custom'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServer, setSelectedServer] = useState<MCPServerTemplate | null>(null);
  const [selectedRuntime, setSelectedRuntime] = useState<'npx' | 'uvx' | 'docker'>('npx');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [tomlPreview, setTomlPreview] = useState('');
  const [adding, setAdding] = useState(false);
  
  const serversByCategory = getServersByCategory();
  const filteredServers = searchQuery ? searchServers(searchQuery) : MCP_SERVERS;

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      form.resetFields();
      setMode('browse');
      setSelectedServer(null);
      setSelectedTools([]);
      setSearchQuery('');
      setTomlPreview('');
    }
  }, [visible, form]);

  useEffect(() => {
    updateTomlPreview();
  }, [selectedServer, selectedRuntime, selectedTools, form]);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Development': <GithubOutlined />,
      'Database': <DatabaseOutlined />,
      'Cloud Storage': <CloudOutlined />,
      'Communication': <MessageOutlined />,
      'File Management': <FileOutlined />,
      'Web & Search': <GlobalOutlined />,
      'Utilities': <SettingOutlined />,
    };
    return icons[category] || <CodeOutlined />;
  };

  const selectServer = (server: MCPServerTemplate) => {
    setSelectedServer(server);
    
    // Determine available runtime
    const availableRuntimes = Object.keys(server.package).filter(rt => 
      server.package[rt as keyof typeof server.package]
    );
    
    if (availableRuntimes.length > 0) {
      setSelectedRuntime(availableRuntimes[0] as 'npx' | 'uvx' | 'docker');
    }
    
    // Auto-select all tools by default
    setSelectedTools(server.tools.map(t => t.name));

    // Get the package string for the selected runtime
    const packageString = server.package[selectedRuntime as keyof typeof server.package] || '';

    // Pre-fill form with server details
    form.setFieldsValue({
      name: server.id,
      package: packageString,
    });

    // Set environment variables if any
    if (server.environmentVariables) {
      const envVars: Record<string, string> = {};
      server.environmentVariables.forEach(env => {
        if (env.required) {
          envVars[env.name] = '';
        }
      });
      form.setFieldsValue({ envVars });
    }

    // Set arguments if any
    if (server.arguments) {
      const args = server.arguments
        .filter(arg => arg.required)
        .map(arg => `${arg.name}=${arg.example || ''}`)
        .join(', ');
      form.setFieldsValue({ args });
    }
  };

  const updateTomlPreview = () => {
    const values = form.getFieldsValue();
    if (!values.name || !values.package) {
      setTomlPreview('');
      return;
    }

    let toml = '[[servers]]\n';
    toml += `  name = "${values.name}"\n`;
    toml += `  package = "${values.package}"\n`;
    
    if (selectedTools.length > 0) {
      toml += `  tools = [${selectedTools.map(t => `"${t}"`).join(', ')}]\n`;
    }
    
    if (values.envVars) {
      const envVars = Object.keys(values.envVars).filter(key => values.envVars[key]);
      if (envVars.length > 0) {
        toml += `  required_env = [${envVars.map(v => `"${v}"`).join(', ')}]\n`;
      }
    }
    
    if (values.args) {
      const args = values.args.split(',').map((a: string) => a.trim()).filter(Boolean);
      if (args.length > 0) {
        toml += `  required_args = [${args.map((a: string) => `"${a}"`).join(', ')}]\n`;
      }
    }

    setTomlPreview(toml);
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      setAdding(true);

      const serverConfig = {
        name: values.name,
        package: values.package,
        tools: selectedTools,
        requiredEnv: values.envVars ? 
          Object.keys(values.envVars).filter(key => values.envVars[key]) : 
          undefined,
        requiredArgs: values.args ? 
          values.args.split(',').map((a: string) => a.trim()).filter(Boolean) : 
          undefined,
      };

      await window.electronAPI.addServer(serverConfig);
      message.success(`Server ${values.name} added successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to add server:', error);
      message.error(error.message || 'Failed to add server');
    } finally {
      setAdding(false);
    }
  };

  const renderBrowseMode = () => (
    <div>
      <Input.Search
        placeholder="Filter servers by name, category, or tool..."
        onChange={(e) => setSearchQuery(e.target.value)}
        value={searchQuery}
        style={{ marginBottom: 16 }}
        allowClear
      />

      {searchQuery && filteredServers.length === 0 ? (
        <Empty description={`No servers found matching "${searchQuery}"`} />
      ) : (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {searchQuery ? (
            // Show filtered results as a flat list
            <List
              dataSource={filteredServers}
              renderItem={(server) => (
                <List.Item
                  onClick={() => selectServer(server)}
                  style={{
                    cursor: 'pointer',
                    background: selectedServer?.id === server.id ? '#1890ff20' : 'transparent',
                    padding: 12,
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <List.Item.Meta
                    avatar={getCategoryIcon(server.category)}
                    title={
                      <Space>
                        {server.name}
                        {server.official && <Tag color="blue">Official</Tag>}
                        <Tag color="default">{server.category}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                          {server.description}
                        </Paragraph>
                        <Space wrap size="small">
                          {server.tools.slice(0, 3).map(tool => (
                            <Tag key={tool.name} color="geekblue" style={{ fontSize: 11 }}>
                              {tool.name}
                            </Tag>
                          ))}
                          {server.tools.length > 3 && (
                            <Tag style={{ fontSize: 11 }}>+{server.tools.length - 3} more</Tag>
                          )}
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            // Show categorized view
            <Collapse defaultActiveKey={Object.keys(serversByCategory)} ghost>
              {Object.entries(serversByCategory).map(([category, servers]) => (
                <Collapse.Panel
                  key={category}
                  header={
                    <Space>
                      {getCategoryIcon(category)}
                      <Text strong>{category}</Text>
                      <Tag>{servers.length} servers</Tag>
                    </Space>
                  }
                >
                  <List
                    dataSource={servers}
                    renderItem={(server) => (
                      <List.Item
                        onClick={() => selectServer(server)}
                        style={{
                          cursor: 'pointer',
                          background: selectedServer?.id === server.id ? '#1890ff20' : 'transparent',
                          padding: 12,
                          borderRadius: 4,
                          marginBottom: 8,
                        }}
                      >
                        <List.Item.Meta
                          title={
                            <Space>
                              {server.name}
                              {server.official && <Tag color="blue" style={{ fontSize: 11 }}>Official</Tag>}
                            </Space>
                          }
                          description={
                            <div>
                              <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8, fontSize: 13 }}>
                                {server.description}
                              </Paragraph>
                              <Space wrap size="small">
                                {server.tools.slice(0, 4).map(tool => (
                                  <Tag key={tool.name} color="geekblue" style={{ fontSize: 11 }}>
                                    {tool.name}
                                  </Tag>
                                ))}
                                {server.tools.length > 4 && (
                                  <Tag style={{ fontSize: 11 }}>+{server.tools.length - 4} more</Tag>
                                )}
                              </Space>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Collapse.Panel>
              ))}
            </Collapse>
          )}
        </div>
      )}

      {selectedServer && (
        <Card title="Server Configuration" style={{ marginTop: 16 }}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="Server Name"
              rules={[{ required: true, message: 'Please enter a server name' }]}
            >
              <Input placeholder="e.g., github, filesystem" />
            </Form.Item>

            <Form.Item
              name="package"
              label="Package"
              rules={[{ required: true, message: 'Please select or enter a package' }]}
            >
              {Object.keys(selectedServer.package).length > 1 ? (
                <Select
                  placeholder="Select runtime package"
                  value={selectedRuntime}
                  onChange={(value) => {
                    setSelectedRuntime(value);
                    const pkg = selectedServer.package[value as keyof typeof selectedServer.package];
                    form.setFieldValue('package', `${value}::${pkg}`);
                  }}
                >
                  {Object.entries(selectedServer.package).map(([runtime, pkg]) => (
                    <Select.Option key={runtime} value={runtime}>
                      {runtime}: {pkg}
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                <Input 
                  value={`${selectedRuntime}::${selectedServer.package[selectedRuntime as keyof typeof selectedServer.package]}`}
                  disabled 
                />
              )}
            </Form.Item>

            {selectedServer.tools && selectedServer.tools.length > 0 && (
              <Form.Item label="Available Tools">
                <Checkbox.Group
                  value={selectedTools}
                  onChange={setSelectedTools}
                  style={{ width: '100%' }}
                >
                  <Row>
                    {selectedServer.tools.map(tool => (
                      <Col span={12} key={tool.name}>
                        <Checkbox value={tool.name}>
                          <span title={tool.description}>{tool.name}</span>
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>
            )}

            {selectedServer.environmentVariables && selectedServer.environmentVariables.length > 0 && (
              <Form.Item label="Environment Variables">
                {selectedServer.environmentVariables.map(env => (
                  <Form.Item
                    key={env.name}
                    name={['envVars', env.name]}
                    label={
                      <Space>
                        {env.name}
                        {env.required && <Tag color="red">Required</Tag>}
                      </Space>
                    }
                    help={env.description}
                    rules={env.required ? [{ required: true, message: `${env.name} is required` }] : []}
                  >
                    <Input.Password 
                      placeholder={env.example ? `e.g., ${env.example}` : `Enter ${env.name}`} 
                    />
                  </Form.Item>
                ))}
              </Form.Item>
            )}

            {selectedServer.arguments && selectedServer.arguments.length > 0 && (
              <Form.Item label="Arguments">
                {selectedServer.arguments.map(arg => (
                  <Form.Item
                    key={arg.name}
                    name={['args', arg.name]}
                    label={
                      <Space>
                        {arg.name}
                        {arg.required && <Tag color="red">Required</Tag>}
                      </Space>
                    }
                    help={arg.description}
                    rules={arg.required ? [{ required: true, message: `${arg.name} is required` }] : []}
                    initialValue={arg.example}
                  >
                    <Input placeholder={arg.example || `Enter value for ${arg.name}`} />
                  </Form.Item>
                ))}
              </Form.Item>
            )}
          </Form>
        </Card>
      )}
    </div>
  );

  const renderCustomMode = () => (
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="Server Name"
        rules={[{ required: true, message: 'Please enter a server name' }]}
      >
        <Input placeholder="e.g., my-custom-server" />
      </Form.Item>

      <Form.Item
        name="package"
        label="Package"
        rules={[{ required: true, message: 'Please enter a package' }]}
        help="Format: runtime::package@version (e.g., npx::my-server@1.0.0)"
      >
        <Input placeholder="e.g., uvx::my-custom-server@1.0.0" />
      </Form.Item>

      <Form.Item
        name="toolsList"
        label="Tools (comma-separated)"
        help="List the tools this server provides"
      >
        <TextArea
          rows={2}
          placeholder="e.g., read_file, write_file, list_directory"
          onChange={(e) => {
            const tools = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
            setSelectedTools(tools);
          }}
        />
      </Form.Item>

      <Form.Item
        name="envVarsList"
        label="Environment Variables (comma-separated)"
        help="Required environment variables"
      >
        <Input placeholder="e.g., API_KEY, BASE_URL" />
      </Form.Item>

      <Form.Item
        name="args"
        label="Arguments (comma-separated)"
        help="Command-line arguments"
      >
        <Input placeholder="e.g., --port=3000, --verbose" />
      </Form.Item>
    </Form>
  );

  return (
    <Modal
      title="Add MCP Server"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="add"
          type="primary"
          loading={adding}
          onClick={handleAdd}
          disabled={!tomlPreview}
        >
          Add Server
        </Button>,
      ]}
    >
      <Tabs activeKey={mode} onChange={(key) => setMode(key as 'browse' | 'custom')}>
        <TabPane tab="Browse Servers" key="browse">
          {renderBrowseMode()}
        </TabPane>
        <TabPane tab="Custom Server" key="custom">
          {renderCustomMode()}
        </TabPane>
      </Tabs>

      {tomlPreview && (
        <div style={{ marginTop: 16 }}>
          <Divider>Configuration Preview</Divider>
          <MonacoEditor
            height="150px"
            language="toml"
            theme="vs-dark"
            value={tomlPreview}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'off',
            }}
          />
        </div>
      )}
    </Modal>
  );
};

export default AddServerModal;