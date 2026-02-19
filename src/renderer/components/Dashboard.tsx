import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Alert,
  Spin,
  Button,
  Tooltip,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  ToolOutlined,
  ApiOutlined,
  LinkOutlined,
  DownloadOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { DaemonStatus, MCPServer } from "@shared/types";

interface DashboardProps {
  daemonStatus: DaemonStatus;
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ daemonStatus, onNavigate }) => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalTools, setTotalTools] = useState(0);
  const [mcpdVersion, setMcpdVersion] = useState<string>("");
  const [mcpdInstalled, setMcpdInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [brewOutdated, setBrewOutdated] = useState(false);
  const [brewLatestVersion, setBrewLatestVersion] = useState<string>("");

  useEffect(() => {
    const checkInstalled = async () => {
      try {
        const installed = await window.electronAPI.isMcpdInstalled();
        setMcpdInstalled(installed);
      } catch (err) {
        console.error("Failed to check mcpd installation:", err);
      }
    };
    checkInstalled();
  }, []);

  // Check for brew updates whenever mcpd is installed (independent of daemon).
  useEffect(() => {
    if (!mcpdInstalled) {
      setBrewOutdated(false);
      setBrewLatestVersion("");
      return;
    }

    const checkBrewUpdates = async () => {
      try {
        const info = await window.electronAPI.getBrewInfo();
        setBrewOutdated(info.outdated);
        if (info.version !== "unknown") {
          setBrewLatestVersion(info.version);
        }
      } catch (err) {
        console.error("Failed to fetch brew info:", err);
      }
    };
    checkBrewUpdates();
  }, [mcpdInstalled]);

  // Fetch servers and version when daemon starts.
  useEffect(() => {
    if (!daemonStatus.running) {
      setMcpdVersion("");
      return;
    }

    loadServers();

    if (!mcpdVersion) {
      const fetchVersion = async () => {
        try {
          const v = await window.electronAPI.getMcpdVersion();
          setMcpdVersion(v);
        } catch (err) {
          console.error("Failed to fetch mcpd version:", err);
        }
      };
      fetchVersion();
    }
  }, [daemonStatus.running]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await window.electronAPI.installMcpd();
      if (result.success) {
        message.success(result.message);
        setMcpdInstalled(true);
        // Fetch version and brew info now that mcpd is installed.
        try {
          const v = await window.electronAPI.getMcpdVersion();
          setMcpdVersion(v);
          const info = await window.electronAPI.getBrewInfo();
          setBrewOutdated(info.outdated);
          if (info.version !== "unknown") setBrewLatestVersion(info.version);
        } catch {
          // Non-critical — version info will be fetched on next poll.
        }
      } else {
        message.error(result.message);
      }
    } catch (err) {
      message.error(`Installation failed: ${err}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const result = await window.electronAPI.upgradeMcpd();
      if (result.success) {
        message.success(result.message);
        setBrewOutdated(false);
        if (result.newVersion) {
          setMcpdVersion(result.newVersion);
        }
      } else {
        message.error(result.message);
      }
    } catch (err) {
      message.error(`Upgrade failed: ${err}`);
    } finally {
      setUpgrading(false);
    }
  };

  const hasUpdate = brewOutdated;

  const loadServers = async () => {
    setLoading(true);
    try {
      const serverList = await window.electronAPI.listServers();

      // Fetch tools for each server and count them
      let toolCount = 0;
      const serversWithTools = await Promise.all(
        serverList.map(async (server: any) => {
          try {
            const tools = await window.electronAPI.getServerTools(server.name);
            toolCount += tools.length;
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
      setTotalTools(toolCount);
    } catch (error) {
      console.error("Failed to load servers:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Daemon Status"
              value={daemonStatus.running ? "Running" : "Stopped"}
              valueStyle={{
                color: daemonStatus.running ? "#52c41a" : "#ff4d4f",
              }}
              prefix={
                daemonStatus.running ? (
                  <CheckCircleOutlined />
                ) : (
                  <CloseCircleOutlined />
                )
              }
              suffix={
                mcpdVersion && mcpdVersion !== "unknown" ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(0,0,0,0.45)",
                      fontWeight: "normal",
                    }}
                  >
                    ({mcpdVersion})
                  </span>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            hoverable={!!onNavigate}
            onClick={() => onNavigate?.("servers")}
            style={onNavigate ? { cursor: "pointer" } : undefined}
          >
            <Statistic
              title="Active Servers"
              value={servers.length}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            hoverable={!!onNavigate}
            onClick={() => onNavigate?.("tools")}
            style={onNavigate ? { cursor: "pointer" } : undefined}
          >
            <Statistic
              title="Available Tools"
              value={totalTools}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="API"
              prefix={<ApiOutlined />}
              valueStyle={{
                color:
                  daemonStatus.running && daemonStatus.apiUrl
                    ? "#52c41a"
                    : "#ff4d4f",
              }}
              formatter={() =>
                daemonStatus.running && daemonStatus.apiUrl ? (
                  <span
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    <Tooltip title={daemonStatus.apiUrl}>
                      <span>Online</span>
                    </Tooltip>
                    <a
                      onClick={() =>
                        window.electronAPI.openExternal(
                          `${daemonStatus.apiUrl}/docs`,
                        )
                      }
                      style={{ marginLeft: 12, fontSize: 16 }}
                    >
                      <LinkOutlined /> Docs
                    </a>
                  </span>
                ) : (
                  <span>Offline</span>
                )
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="System Status">
            {!daemonStatus.running ? (
              mcpdInstalled === false ? (
                <Alert
                  message="mcpd Not Installed"
                  description="mcpd is required to manage MCP servers. Install it via Homebrew."
                  type="info"
                  showIcon
                  action={
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      loading={installing}
                      onClick={handleInstall}
                    >
                      Install mcpd
                    </Button>
                  }
                />
              ) : (
                <Alert
                  message="Daemon Not Running"
                  description="Start the daemon to begin managing MCP servers."
                  type="warning"
                  showIcon
                />
              )
            ) : loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : (
              <div>
                <Alert
                  message="System Healthy"
                  description={`All systems operational. ${servers.length} server(s) available.`}
                  type="success"
                  showIcon
                />
                {hasUpdate && (
                  <Alert
                    message="Update Available"
                    description={`mcpd v${brewLatestVersion} is available (installed: ${mcpdVersion}).`}
                    type="info"
                    showIcon
                    style={{ marginTop: 12 }}
                    action={
                      <Button
                        icon={<SyncOutlined />}
                        loading={upgrading}
                        onClick={handleUpgrade}
                      >
                        Upgrade
                      </Button>
                    }
                  />
                )}
                {daemonStatus.logPath && (
                  <div style={{ marginTop: 16 }}>
                    <strong>Log Path:</strong> {daemonStatus.logPath}
                  </div>
                )}
                {daemonStatus.pid && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Process ID:</strong> {daemonStatus.pid}
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
