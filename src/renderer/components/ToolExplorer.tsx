import React, { useState, useEffect } from 'react';
import { Card, Select, List, Button, Form, Input, Typography, Space, message, Spin, Empty } from 'antd';
import { PlayCircleOutlined, CopyOutlined } from '@ant-design/icons';
import { MCPServer, MCPTool } from '@shared/types';
import MonacoEditor from '@monaco-editor/react';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ToolExplorer: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState<string>('{}');
  const [toolResult, setToolResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (selectedServer) {
      loadTools(selectedServer);
    }
  }, [selectedServer]);

  const loadServers = async () => {
    try {
      const serverList = await window.electronAPI.listServers();
      setServers(serverList);
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  };

  const loadTools = async (serverName: string) => {
    setLoading(true);
    try {
      const toolList = await window.electronAPI.getServerTools(serverName);
      setTools(toolList);
      setSelectedTool(null);
      setToolResult(null);
    } catch (error) {
      console.error('Failed to load tools:', error);
      message.error('Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  const executeTool = async () => {
    if (!selectedServer || !selectedTool) return;

    setExecuting(true);
    try {
      const args = JSON.parse(toolArgs);
      const result = await window.electronAPI.callTool(
        selectedServer,
        selectedTool.name,
        args
      );
      setToolResult(result);
      message.success('Tool executed successfully');
    } catch (error) {
      console.error('Failed to execute tool:', error);
      message.error('Failed to execute tool: ' + (error as Error).message);
      setToolResult({ error: (error as Error).message });
    } finally {
      setExecuting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Select Server:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select a server to explore its tools"
              value={selectedServer}
              onChange={setSelectedServer}
              options={servers.map(s => ({ label: s.name, value: s.name }))}
            />
          </div>
        </Space>
      </Card>

      {selectedServer && (
        <div style={{ display: 'flex', gap: 16 }}>
          <Card title="Available Tools" style={{ flex: '0 0 300px' }}>
            {loading ? (
              <Spin />
            ) : tools.length === 0 ? (
              <Empty description="No tools available" />
            ) : (
              <List
                dataSource={tools}
                renderItem={(tool) => (
                  <List.Item
                    onClick={() => {
                      setSelectedTool(tool);
                      setToolArgs(JSON.stringify(tool.inputSchema?.properties || {}, null, 2));
                      setToolResult(null);
                    }}
                    style={{
                      cursor: 'pointer',
                      background: selectedTool?.name === tool.name ? '#1890ff20' : 'transparent',
                      padding: 8,
                      borderRadius: 4,
                    }}
                  >
                    <div>
                      <Text strong>{tool.name}</Text>
                      {tool.description && (
                        <Paragraph
                          ellipsis={{ rows: 2 }}
                          style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}
                        >
                          {tool.description}
                        </Paragraph>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card title={selectedTool ? `Tool: ${selectedTool.name}` : 'Select a Tool'} style={{ flex: 1 }}>
            {selectedTool ? (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {selectedTool.description && (
                  <div>
                    <Text strong>Description:</Text>
                    <Paragraph>{selectedTool.description}</Paragraph>
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>Arguments (JSON):</Text>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(toolArgs)}
                    >
                      Copy
                    </Button>
                  </div>
                  <MonacoEditor
                    height="200px"
                    language="json"
                    theme="vs-dark"
                    value={toolArgs}
                    onChange={(value) => setToolArgs(value || '{}')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                    }}
                  />
                </div>

                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={executeTool}
                  loading={executing}
                  block
                >
                  Execute Tool
                </Button>

                {toolResult && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text strong>Result:</Text>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(JSON.stringify(toolResult, null, 2))}
                      >
                        Copy
                      </Button>
                    </div>
                    <MonacoEditor
                      height="300px"
                      language="json"
                      theme="vs-dark"
                      value={JSON.stringify(toolResult, null, 2)}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                      }}
                    />
                  </div>
                )}
              </Space>
            ) : (
              <Empty description="Select a tool to view details" />
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default ToolExplorer;