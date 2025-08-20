import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Tooltip } from 'antd';
import {
  CloudServerOutlined,
  SettingOutlined,
  CodeOutlined,
  DashboardOutlined,
  FileTextOutlined,
  PoweroffOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import ServerManager from './components/ServerManager';
import ToolExplorer from './components/ToolExplorer';
import ConfigEditor from './components/ConfigEditor';
import LogViewer from './components/LogViewer';
import QuickSetup from './components/QuickSetup';
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
      addServer: (server: any) => Promise<void>;
      removeServer: (name: string) => Promise<void>;
      searchServers: (query: string) => Promise<any[]>;
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

  const testIPC = async () => {
    console.log('Testing IPC...');
    console.log('window.electronAPI:', (window as any).electronAPI);
    console.log('window.preloadTest:', (window as any).preloadTest);
    
    try {
      // Test if preload script ran at all
      const preloadTest = (window as any).preloadTest;
      if (preloadTest) {
        console.log('Preload test object found:', preloadTest);
      }
      
      // Test if electronAPI exists
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        console.log('electronAPI found, testing test function...');
        if (electronAPI.test) {
          const testResult = electronAPI.test();
          console.log('electronAPI.test() result:', testResult);
        }
      } else {
        console.error('electronAPI not found on window object');
      }
      
      const result = electronAPI ? 'electronAPI available' : 'electronAPI not available';
      console.log('IPC test result:', result);
    } catch (error) {
      console.error('IPC test error:', error);
    }
  };

  const toggleDaemon = async () => {
    console.log('toggleDaemon called, current status:', daemonStatus);
    
    // First test IPC
    await testIPC();
    
    try {
      if (daemonStatus.running) {
        console.log('Stopping daemon...');
        await window.electronAPI.stopDaemon();
        console.log('Daemon stopped');
      } else {
        console.log('Starting daemon...');
        try {
          // Add a timeout to prevent indefinite hanging
          const startPromise = window.electronAPI.startDaemon();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Daemon start timeout after 10 seconds')), 10000)
          );
          
          const result = await Promise.race([startPromise, timeoutPromise]);
          console.log('Start daemon result:', result);
        } catch (err) {
          console.error('Failed to start daemon:', err);
          throw err;
        }
      }
      console.log('Checking daemon status after toggle...');
      await checkDaemonStatus();
    } catch (error) {
      console.error('Failed to toggle daemon:', error);
    }
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <Dashboard daemonStatus={daemonStatus} />;
      case 'connect':
        return <QuickSetup />;
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
          <Menu.Item key="connect" icon={<RocketOutlined />}>
            Connect
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>
            {selectedMenu === 'connect' ? 'Connect' : selectedMenu.charAt(0).toUpperCase() + selectedMenu.slice(1)}
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