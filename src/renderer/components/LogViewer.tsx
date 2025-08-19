import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Select, Input, Badge } from 'antd';
import { ReloadOutlined, ClearOutlined, DownloadOutlined } from '@ant-design/icons';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const { Search } = Input;

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<string[]>([]);
  const [logLevel, setLogLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (terminalRef.current && !terminal.current) {
      terminal.current = new Terminal({
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
        },
        fontSize: 12,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorBlink: false,
        disableStdin: true,
      });
      
      fitAddon.current = new FitAddon();
      terminal.current.loadAddon(fitAddon.current);
      terminal.current.open(terminalRef.current);
      fitAddon.current.fit();
    }

    loadLogs();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    filterLogs();
  }, [logs, logLevel, searchTerm]);

  useEffect(() => {
    if (terminal.current) {
      terminal.current.clear();
      filteredLogs.forEach(log => {
        const coloredLog = colorizeLog(log);
        terminal.current!.writeln(coloredLog);
      });
    }
  }, [filteredLogs]);

  const loadLogs = async () => {
    try {
      const logLines = await window.electronAPI.getDaemonLogs(500);
      setLogs(logLines);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Filter by log level
    if (logLevel !== 'all') {
      filtered = filtered.filter(log => 
        log.toLowerCase().includes(logLevel.toLowerCase())
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  const colorizeLog = (log: string): string => {
    if (log.includes('ERROR')) {
      return `\x1b[31m${log}\x1b[0m`; // Red
    } else if (log.includes('WARN')) {
      return `\x1b[33m${log}\x1b[0m`; // Yellow
    } else if (log.includes('INFO')) {
      return `\x1b[36m${log}\x1b[0m`; // Cyan
    } else if (log.includes('DEBUG')) {
      return `\x1b[90m${log}\x1b[0m`; // Gray
    }
    return log;
  };

  const clearTerminal = () => {
    if (terminal.current) {
      terminal.current.clear();
    }
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcpd-logs-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogStats = () => {
    const stats = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
    };

    logs.forEach(log => {
      if (log.includes('ERROR')) stats.error++;
      else if (log.includes('WARN')) stats.warn++;
      else if (log.includes('INFO')) stats.info++;
      else if (log.includes('DEBUG')) stats.debug++;
    });

    return stats;
  };

  const stats = getLogStats();

  return (
    <Card
      title={
        <Space>
          <span>Log Viewer</span>
          <Badge count={stats.error} style={{ backgroundColor: '#ff4d4f' }} />
          <Badge count={stats.warn} style={{ backgroundColor: '#faad14' }} />
        </Space>
      }
      extra={
        <Space>
          <Search
            placeholder="Search logs..."
            allowClear
            style={{ width: 200 }}
            onSearch={setSearchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            value={logLevel}
            onChange={setLogLevel}
            style={{ width: 100 }}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Error', value: 'error' },
              { label: 'Warn', value: 'warn' },
              { label: 'Info', value: 'info' },
              { label: 'Debug', value: 'debug' },
            ]}
          />
          <Button
            type={autoRefresh ? 'primary' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button icon={<ClearOutlined />} onClick={clearTerminal}>
            Clear
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadLogs}>
            Download
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadLogs}>
            Refresh
          </Button>
        </Space>
      }
    >
      <div
        ref={terminalRef}
        style={{
          height: 600,
          backgroundColor: '#1e1e1e',
          padding: 8,
          borderRadius: 4,
        }}
      />
    </Card>
  );
};

export default LogViewer;