import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Alert, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, CloudServerOutlined, ToolOutlined } from '@ant-design/icons';
import { DaemonStatus, MCPServer } from '@shared/types';

interface DashboardProps {
  daemonStatus: DaemonStatus;
}

const Dashboard: React.FC<DashboardProps> = ({ daemonStatus }) => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalTools, setTotalTools] = useState(0);

  useEffect(() => {
    if (daemonStatus.running) {
      loadServers();
    }
  }, [daemonStatus]);

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
        })
      );
      
      setServers(serversWithTools);
      setTotalTools(toolCount);
    } catch (error) {
      console.error('Failed to load servers:', error);
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
              value={daemonStatus.running ? 'Running' : 'Stopped'}
              valueStyle={{ color: daemonStatus.running ? '#52c41a' : '#ff4d4f' }}
              prefix={daemonStatus.running ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Servers"
              value={servers.length}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
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
              title="API Endpoint"
              value={daemonStatus.apiUrl || 'Not Available'}
              valueStyle={{ fontSize: 14 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="System Status">
            {!daemonStatus.running ? (
              <Alert
                message="Daemon Not Running"
                description="Start the daemon to begin managing MCP servers."
                type="warning"
                showIcon
              />
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
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