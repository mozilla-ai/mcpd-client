import React, { useState, useEffect } from "react";
import { Layout, Menu, Badge, Tooltip, message } from "antd";
import {
  CheckCircleOutlined,
  CloudServerOutlined,
  SettingOutlined,
  CodeOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PoweroffOutlined,
  RocketOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import Dashboard from "./components/Dashboard";
import ServerManager from "./components/ServerManager";
import ToolExplorer from "./components/ToolExplorer";
import ConfigEditor from "./components/ConfigEditor";
import LogViewer from "./components/LogViewer";
import QuickSetup from "./components/QuickSetup";
import { DaemonStatus, RegistryServer } from "@shared/types";

const { Header, Sider, Content } = Layout;

declare global {
  interface Window {
    electronAPI: {
      startDaemon: () => Promise<DaemonStatus>;
      stopDaemon: () => Promise<void>;
      getDaemonStatus: () => Promise<DaemonStatus>;
      getDaemonLogs: (lines?: number) => Promise<string[]>;
      getMcpdVersion: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      isMcpdInstalled: () => Promise<boolean>;
      installMcpd: () => Promise<{ success: boolean; message: string }>;
      upgradeMcpd: () => Promise<{
        success: boolean;
        message: string;
        oldVersion?: string;
        newVersion?: string;
      }>;
      getBrewInfo: () => Promise<{ version: string; outdated: boolean }>;
      openExternal: (url: string) => Promise<void>;
      listServers: () => Promise<any[]>;
      addServer: (server: any) => Promise<void>;
      removeServer: (name: string) => Promise<void>;
      searchServers: (query: string) => Promise<RegistryServer[]>;
      getServerTools: (name: string) => Promise<any[]>;
      saveServerSecrets: (
        serverName: string,
        env: Record<string, string>,
        args: string[],
      ) => Promise<void>;
      getSecretsPath: () => Promise<string>;
      callTool: (server: string, tool: string, args: any) => Promise<any>;
      loadConfig: () => Promise<any>;
      saveConfig: (content: string) => Promise<void>;
      exportConfig: () => Promise<string>;
      setupClaude: (
        serverName: string,
      ) => Promise<{ success: boolean; message: string }>;
      setupHTTP: (
        serverName: string,
      ) => Promise<{ success: boolean; url?: string; message: string }>;
      setupCursor: (
        serverName: string,
      ) => Promise<{ success: boolean; message: string }>;
    };
  }
}

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState("dashboard");
  const [toolsServer, setToolsServer] = useState<string>("");
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>({
    running: false,
  });
  const [appVersion, setAppVersion] = useState<string>("");
  const [mcpdInstalled, setMcpdInstalled] = useState<boolean | null>(null);
  const [mcpdVersion, setMcpdVersion] = useState<string>("");
  const [daemonToggling, setDaemonToggling] = useState(false);
  const [brewOutdated, setBrewOutdated] = useState(false);
  const [brewLatestVersion, setBrewLatestVersion] = useState<string>("");

  useEffect(() => {
    checkDaemonStatus();
    checkMcpdInstalled();
    const interval = setInterval(() => {
      checkDaemonStatus();
      checkMcpdInstalled();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion).catch(console.error);
  }, []);

  // Fetch mcpd version and brew info when install state changes.
  useEffect(() => {
    if (mcpdInstalled) {
      window.electronAPI
        .getMcpdVersion()
        .then((v) => {
          if (v && v !== "unknown") setMcpdVersion(v);
        })
        .catch(console.error);
      window.electronAPI
        .getBrewInfo()
        .then((info) => {
          setBrewOutdated(info.outdated);
          if (info.version !== "unknown") setBrewLatestVersion(info.version);
        })
        .catch(console.error);
    } else {
      setMcpdVersion("");
      setBrewOutdated(false);
      setBrewLatestVersion("");
    }
  }, [mcpdInstalled, daemonStatus.running]);

  const checkMcpdInstalled = async () => {
    try {
      const installed = await window.electronAPI.isMcpdInstalled();
      setMcpdInstalled(installed);
    } catch (error) {
      console.error("Failed to check mcpd installation:", error);
    }
  };

  const checkDaemonStatus = async () => {
    try {
      const status = await window.electronAPI.getDaemonStatus();
      setDaemonStatus(status);
    } catch (error) {
      console.error("Failed to check daemon status:", error);
    }
  };

  const toggleDaemon = async () => {
    setDaemonToggling(true);
    try {
      if (daemonStatus.running) {
        await window.electronAPI.stopDaemon();
      } else {
        const startPromise = window.electronAPI.startDaemon();
        // Prevent unhandled rejection if timeout wins the race.
        startPromise.catch(() => {});
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Daemon failed to start within 10 seconds")),
            10000,
          ),
        );
        await Promise.race([startPromise, timeoutPromise]);
      }
      await checkDaemonStatus();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";
      message.error(msg);
    } finally {
      setDaemonToggling(false);
    }
  };

  const navigateToTools = (serverName: string) => {
    setToolsServer(serverName);
    setSelectedMenu("tools");
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case "dashboard":
        return (
          <Dashboard daemonStatus={daemonStatus} onNavigate={setSelectedMenu} />
        );
      case "connect":
        return <QuickSetup />;
      case "servers":
        return <ServerManager onViewTools={navigateToTools} />;
      case "tools":
        return <ToolExplorer initialServer={toolsServer} />;
      case "config":
        return <ConfigEditor />;
      case "logs":
        return <LogViewer />;
      default:
        return (
          <Dashboard daemonStatus={daemonStatus} onNavigate={setSelectedMenu} />
        );
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div
          style={{ height: 32, margin: 16, textAlign: "center", color: "#fff" }}
        >
          {!collapsed && <h3>mcpd Client</h3>}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedMenu]}
          mode="inline"
          onClick={({ key }) => {
            // Clear stale server pre-selection when navigating via sidebar.
            if (key === "tools") setToolsServer("");
            setSelectedMenu(key);
          }}
        >
          <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
            Dashboard
          </Menu.Item>
          <Menu.Item key="servers" icon={<CloudServerOutlined />}>
            Servers
          </Menu.Item>
          <Menu.Item key="tools" icon={<CodeOutlined />}>
            Tools
          </Menu.Item>
          <Menu.Item key="config" icon={<SettingOutlined />}>
            Configuration
          </Menu.Item>
          <Menu.Item key="logs" icon={<FileTextOutlined />}>
            Logs
          </Menu.Item>
          <Menu.Item key="connect" icon={<RocketOutlined />}>
            Connect
          </Menu.Item>
        </Menu>
        {!collapsed && appVersion && (
          <div
            style={{
              position: "absolute",
              bottom: 48,
              left: 0,
              right: 0,
              textAlign: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
            }}
          >
            v{appVersion}
          </div>
        )}
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ margin: 0, color: "#fff" }}>
            {selectedMenu === "connect"
              ? "Connect"
              : selectedMenu.charAt(0).toUpperCase() + selectedMenu.slice(1)}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {mcpdInstalled !== null && (
              <Tooltip
                title={
                  !mcpdInstalled
                    ? "Install mcpd via: brew install mozilla-ai/tap/mcpd"
                    : brewOutdated && brewLatestVersion
                      ? `Upgrade available (${mcpdVersion} \u2192 v${brewLatestVersion})`
                      : "Latest version installed"
                }
              >
                <span style={{ color: "#fff", fontSize: 13 }}>
                  {mcpdInstalled ? (
                    <>
                      {brewOutdated ? (
                        <WarningOutlined style={{ color: "#faad14" }} />
                      ) : (
                        <CheckCircleOutlined style={{ color: "#52c41a" }} />
                      )}{" "}
                      mcpd{mcpdVersion ? ` ${mcpdVersion}` : ""}
                    </>
                  ) : (
                    <>
                      <WarningOutlined style={{ color: "#faad14" }} /> mcpd not
                      found
                    </>
                  )}
                </span>
              </Tooltip>
            )}
            <Badge
              status={daemonStatus.running ? "success" : "error"}
              text={daemonStatus.running ? "Daemon Running" : "Daemon Stopped"}
              style={{ color: "#fff" }}
            />
            <Tooltip
              title={
                daemonToggling
                  ? daemonStatus.running
                    ? "Stopping\u2026"
                    : "Starting\u2026"
                  : daemonStatus.running
                    ? "Stop Daemon"
                    : "Start Daemon"
              }
            >
              {daemonToggling ? (
                <LoadingOutlined style={{ fontSize: 20, color: "#faad14" }} />
              ) : (
                <PoweroffOutlined
                  onClick={toggleDaemon}
                  style={{
                    fontSize: 20,
                    color: daemonStatus.running ? "#52c41a" : "#ff4d4f",
                    cursor: "pointer",
                  }}
                />
              )}
            </Tooltip>
          </div>
        </Header>
        <Content style={{ margin: 24 }}>{renderContent()}</Content>
      </Layout>
    </Layout>
  );
};

export default App;
