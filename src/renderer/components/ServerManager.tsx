import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { MCPServer, RegistryData } from "@shared/types";
import AddServerModal from "./AddServerModal";

import bundledRegistry from "../data/registry.json";
import clientServers from "../data/client-servers.json";

const { Text } = Typography;

// Build a lookup from server name/id to its recommended installation version.
function buildVersionMap(
  ...registries: RegistryData[]
): Record<string, string> {
  const map: Record<string, string> = {};
  // Earlier registries take precedence (bundled mozilla-ai wins over client extras).
  for (const registry of registries) {
    for (const [id, server] of Object.entries(registry)) {
      if (map[id]) continue;
      const installations = Object.values(server.installations);
      const recommended = installations.find((i) => i.recommended);
      const version = (recommended ?? installations[0])?.version;
      if (version) map[id] = version;
    }
  }
  return map;
}

const ServerManager: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const versionMap = useMemo(
    () =>
      buildVersionMap(
        bundledRegistry as RegistryData,
        clientServers as RegistryData,
      ),
    [],
  );

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
        }),
      );

      setServers(serversWithTools);
    } catch (error) {
      console.error("Failed to load servers:", error);
      message.error("Failed to load servers");
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
      console.error("Failed to remove server:", error);
      message.error("Failed to remove server");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: "Package",
      dataIndex: "package",
      key: "package",
      render: (text: string) => text || "N/A",
    },
    {
      title: "Version",
      // Looks up by server name which matches the registry ID set during browse-mode add.
      dataIndex: "name",
      key: "version",
      render: (name: string) => {
        const version = versionMap[name];
        return version ? (
          <Tag color="blue">v{version}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const color =
          status === "running"
            ? "green"
            : status === "stopped"
              ? "red"
              : "orange";
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: "Health",
      dataIndex: "health",
      key: "health",
      render: (health: string) => {
        const color =
          health === "healthy"
            ? "green"
            : health === "unhealthy"
              ? "red"
              : "default";
        return <Tag color={color}>{health?.toUpperCase() || "UNKNOWN"}</Tag>;
      },
    },
    {
      title: "Tools",
      dataIndex: "tools",
      key: "tools",
      render: (tools: string[]) => tools?.length || 0,
    },
    {
      title: "Actions",
      key: "actions",
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
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
