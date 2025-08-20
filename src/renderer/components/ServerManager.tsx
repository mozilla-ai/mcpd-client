import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { MCPServer } from '@shared/types';
import AddServerModal from './AddServerModal';

const ServerManager: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

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

  return (
    <>
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
    </Card>

    <AddServerModal
      visible={addModalVisible}
      onClose={() => setAddModalVisible(false)}
      onSuccess={() => {
        setAddModalVisible(false);
        loadServers();
      }}
    />
    </>
  );
};

export default ServerManager;