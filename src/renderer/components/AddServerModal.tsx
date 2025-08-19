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
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  CodeOutlined,
  SettingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import MonacoEditor from '@monaco-editor/react';

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
  const [mode, setMode] = useState<'registry' | 'custom'>('registry');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RegistryServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<RegistryServer | null>(null);
  const [selectedRuntime, setSelectedRuntime] = useState<string>('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tomlPreview, setTomlPreview] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      form.resetFields();
      setMode('registry');
      setSelectedServer(null);
      setSelectedTools([]);
      setSearchResults([]);
      setShowAdvanced(false);
      setTomlPreview('');
    }
  }, [visible, form]);

  useEffect(() => {
    updateTomlPreview();
  }, [selectedServer, selectedRuntime, selectedTools, form]);

  const searchServers = async (query: string) => {
    setSearching(true);
    try {
      const results = await window.electronAPI.searchServers(query || '*');
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error('Failed to search servers:', error);
      message.error('Failed to search servers');
    } finally {
      setSearching(false);
    }
  };

  const selectServer = (server: RegistryServer) => {
    setSelectedServer(server);
    
    // Auto-select runtime if only one available
    if (server.runtimes && server.runtimes.length === 1) {
      setSelectedRuntime(server.runtimes[0].package);
    }
    
    // Auto-select all tools by default
    if (server.tools) {
      setSelectedTools(server.tools);
    }

    // Pre-fill form with server details
    form.setFieldsValue({
      name: server.name,
      package: server.runtimes?.[0]?.package || '',
    });
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

  const renderRegistryMode = () => (
    <div>
      <Input.Search
        placeholder="Search for MCP servers (e.g., github, filesystem, slack)"
        onSearch={searchServers}
        enterButton={<SearchOutlined />}
        loading={searching}
        style={{ marginBottom: 16 }}
      />

      {searchResults.length > 0 && (
        <List
          dataSource={searchResults}
          loading={searching}
          style={{ maxHeight: 300, overflow: 'auto', marginBottom: 16 }}
          renderItem={(server) => (
            <List.Item
              onClick={() => selectServer(server)}
              style={{
                cursor: 'pointer',
                background: selectedServer?.id === server.id ? '#1890ff20' : 'transparent',
                padding: 12,
                borderRadius: 4,
              }}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {server.name}
                    {server.official && <Tag color="blue">Official</Tag>}
                    {server.license && <Tag>{server.license}</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <Paragraph ellipsis={{ rows: 2 }}>
                      {server.description}
                    </Paragraph>
                    {server.categories && (
                      <Space wrap>
                        {server.categories.map(cat => (
                          <Tag key={cat} color="default">{cat}</Tag>
                        ))}
                      </Space>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
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
              {selectedServer.runtimes && selectedServer.runtimes.length > 1 ? (
                <Select
                  placeholder="Select runtime package"
                  onChange={setSelectedRuntime}
                >
                  {selectedServer.runtimes.map(rt => (
                    <Select.Option key={rt.package} value={rt.package}>
                      {rt.runtime}: {rt.package} @ {rt.version}
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                <Input placeholder="e.g., npx::@modelcontextprotocol/server-github" />
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
                      <Col span={12} key={tool}>
                        <Checkbox value={tool}>{tool}</Checkbox>
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
                  >
                    <Input.Password placeholder={`Enter ${env.name}`} />
                  </Form.Item>
                ))}
              </Form.Item>
            )}

            <Form.Item
              name="args"
              label="Additional Arguments (comma-separated)"
              help="e.g., --directory=/tmp, --port=3000"
            >
              <Input placeholder="Optional command-line arguments" />
            </Form.Item>
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
      <Tabs activeKey={mode} onChange={(key) => setMode(key as 'registry' | 'custom')}>
        <TabPane tab="Registry Servers" key="registry">
          {renderRegistryMode()}
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