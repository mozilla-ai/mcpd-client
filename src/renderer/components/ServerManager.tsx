import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { MCPServer } from '@shared/types';

const ServerManager: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form] = Form.useForm();

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
      message.error('Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = async (values: any) => {
    try {
      await window.electronAPI.addServer(values.name, values.package || values.name);
      message.success(`Server ${values.name} added successfully`);
      setAddModalVisible(false);
      form.resetFields();
      loadServers();
    } catch (error) {
      console.error('Failed to add server:', error);
      message.error('Failed to add server');
    }
  };

  const handleRemoveServer = async (name: string) => {
    try {
      await window.electronAPI.removeServer(name);
      message.success(`Server ${name} removed successfully`);
      loadServers();
    } catch (error) {
      console.error('Failed to remove server:', error);
      message.error('Failed to remove server');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Package',
      dataIndex: 'package',
      key: 'package',
      render: (text: string) => text || 'N/A',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'running' ? 'green' : status === 'stopped' ? 'red' : 'orange';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Health',
      dataIndex: 'health',
      key: 'health',
      render: (health: string) => {
        const color = health === 'healthy' ? 'green' : health === 'unhealthy' ? 'red' : 'default';
        return <Tag color={color}>{health?.toUpperCase() || 'UNKNOWN'}</Tag>;
      },
    },
    {
      title: 'Tools',
      dataIndex: 'tools',
      key: 'tools',
      render: (tools: string[]) => tools?.length || 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: MCPServer) => (
        <Space>
          <Popconfirm
            title="Are you sure you want to remove this server?"
            onConfirm={() => handleRemoveServer(record.name)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const popularServers = [
    { value: 'time', label: 'Time Server' },
    { value: 'github', label: 'GitHub Server' },
    { value: 'filesystem', label: 'FileSystem Server' },
    { value: 'slack', label: 'Slack Server' },
    { value: 'google-drive', label: 'Google Drive Server' },
  ];

  return (
    <Card
      title="MCP Servers"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadServers}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            Add Server
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={servers}
        rowKey="name"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="Add MCP Server"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddServer}>
          <Form.Item
            name="name"
            label="Server Name"
            rules={[{ required: true, message: 'Please select or enter a server name' }]}
          >
            <Select
              showSearch
              placeholder="Select a server or type custom name"
              options={popularServers}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="package"
            label="Package (Optional)"
            help="Leave empty to use default package for the server"
          >
            <Input placeholder="e.g., uvx::modelcontextprotocol/time-server@1.0.0" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Add Server
              </Button>
              <Button onClick={() => {
                setAddModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ServerManager;