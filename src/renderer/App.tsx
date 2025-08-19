import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Tooltip } from 'antd';
import {
  CloudServerOutlined,
  SettingOutlined,
  CodeOutlined,
  DashboardOutlined,
  FileTextOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import ServerManager from './components/ServerManager';
import ToolExplorer from './components/ToolExplorer';
import ConfigEditor from './components/ConfigEditor';
import LogViewer from './components/LogViewer';
import { DaemonStatus } from '@shared/types';

const { Header, Sider, Content } = Layout;

declare global {
  interface Window {
    electronAPI: {
      startDaemon: () => Promise<DaemonStatus>;
      stopDaemon: () => Promise<void>;
      getDaemonStatus: () => Promise<DaemonStatus>;
      getDaemonLogs: (lines?: number) => Promise<string[]>;
      listServers: () => Promise<any[]>;
      addServer: (name: string, packageName: string) => Promise<void>;
      removeServer: (name: string) => Promise<void>;
      getServerTools: (name: string) => Promise<any[]>;
      callTool: (server: string, tool: string, args: any) => Promise<any>;
      loadConfig: () => Promise<any>;
      saveConfig: (content: string) => Promise<void>;
      exportConfig: () => Promise<string>;
    };
  }
}

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>({
    running: false,
  });

  useEffect(() => {
    checkDaemonStatus();
    const interval = setInterval(checkDaemonStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkDaemonStatus = async () => {
    try {
      const status = await window.electronAPI.getDaemonStatus();
      setDaemonStatus(status);
    } catch (error) {
      console.error('Failed to check daemon status:', error);
    }
  };

  const toggleDaemon = async () => {
    try {
      if (daemonStatus.running) {
        await window.electronAPI.stopDaemon();
      } else {
        await window.electronAPI.startDaemon();
      }
      await checkDaemonStatus();
    } catch (error) {
      console.error('Failed to toggle daemon:', error);
    }
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <Dashboard daemonStatus={daemonStatus} />;
      case 'servers':
        return <ServerManager />;
      case 'tools':
        return <ToolExplorer />;
      case 'config':
        return <ConfigEditor />;
      case 'logs':
        return <LogViewer />;
      default:
        return <Dashboard daemonStatus={daemonStatus} />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, textAlign: 'center', color: '#fff' }}>
          {!collapsed && <h3>MCPD Client</h3>}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedMenu]}
          mode="inline"
          onClick={({ key }) => setSelectedMenu(key)}
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
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>
            {selectedMenu.charAt(0).toUpperCase() + selectedMenu.slice(1)}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge
              status={daemonStatus.running ? 'success' : 'error'}
              text={daemonStatus.running ? 'Daemon Running' : 'Daemon Stopped'}
              style={{ color: '#fff' }}
            />
            <Tooltip title={daemonStatus.running ? 'Stop Daemon' : 'Start Daemon'}>
              <PoweroffOutlined
                onClick={toggleDaemon}
                style={{
                  fontSize: 20,
                  color: daemonStatus.running ? '#52c41a' : '#ff4d4f',
                  cursor: 'pointer',
                }}
              />
            </Tooltip>
          </div>
        </Header>
        <Content style={{ margin: 24 }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;