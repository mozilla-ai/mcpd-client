import React, { useState, useEffect } from "react";
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
import { MCPServer } from "@shared/types";
import AddServerModal from "./AddServerModal";

const { Text } = Typography;

interface ServerManagerProps {
  onViewTools?: (serverName: string) => void;
}

const ServerManager: React.FC<ServerManagerProps> = ({ onViewTools }) => {
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

  // Parse "runtime::package@version" into its parts.
  const parsePackage = (
    pkg: string,
  ): { runtime: string; name: string; version: string } => {
    if (!pkg) return { runtime: "", name: "", version: "" };
    const runtimeSep = pkg.indexOf("::");
    const runtime = runtimeSep >= 0 ? pkg.slice(0, runtimeSep) : "";
    const rest = runtimeSep >= 0 ? pkg.slice(runtimeSep + 2) : pkg;
    const atIdx = rest.lastIndexOf("@");
    const name = atIdx >= 0 ? rest.slice(0, atIdx) : rest;
    const version = atIdx >= 0 ? rest.slice(atIdx + 1) : "";
    return { runtime, name, version };
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) =>
        onViewTools ? (
          <a onClick={() => onViewTools(text)}>{text}</a>
        ) : (
          <strong>{text}</strong>
        ),
    },
    {
      title: "Runtime",
      dataIndex: "package",
      key: "runtime",
      render: (pkg: string) => {
        const { runtime } = parsePackage(pkg);
        return runtime ? <Tag>{runtime}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: "Package",
      dataIndex: "package",
      key: "package",
      render: (pkg: string) => {
        const { name } = parsePackage(pkg);
        return name || <Text type="secondary">—</Text>;
      },
    },
    {
      title: "Version",
      dataIndex: "package",
      key: "version",
      render: (pkg: string) => {
        const { version } = parsePackage(pkg);
        return version ? (
          <Tag color="blue">{version}</Tag>
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
      render: (tools: string[], record: MCPServer) => {
        const count = tools?.length || 0;
        return onViewTools && count > 0 ? (
          <a onClick={() => onViewTools(record.name)}>{count}</a>
        ) : (
          count
        );
      },
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
