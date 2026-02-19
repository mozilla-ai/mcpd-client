import React, { useState, useEffect } from "react";
import { Card, Button, Space, message, Alert } from "antd";
import {
  SaveOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";

const ConfigEditor: React.FC = () => {
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;
    monaco.languages.register({ id: "toml" });
    monaco.languages.setMonarchTokensProvider("toml", {
      tokenizer: {
        root: [
          [/#.*$/, "comment"],
          [/\[\[[\w.]+\]\]/, "type.identifier"],
          [/\[[\w.]+\]/, "type.identifier"],
          [/[a-zA-Z_][\w]*(?=\s*=)/, "variable"],
          [/=/, "delimiter"],
          [/"[^"]*"/, "string"],
          [/'[^']*'/, "string"],
          [/true|false/, "keyword"],
          [/[+-]?\d+(\.\d+)?/, "number"],
        ],
      },
    });
  }, [monaco]);
  const [configContent, setConfigContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await window.electronAPI.loadConfig();
      console.log("Loaded config:", config);
      const content = config.content || "servers = []";
      console.log("Config content:", content);
      setConfigContent(content);
      setOriginalContent(content);
    } catch (error) {
      console.error("Failed to load config:", error);
      message.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await window.electronAPI.saveConfig(configContent);
      setOriginalContent(configContent);
      message.success("Configuration saved successfully");
    } catch (error) {
      console.error("Failed to save config:", error);
      message.error("Failed to save configuration");
    }
  };

  const exportConfig = async () => {
    try {
      const exportedConfig = await window.electronAPI.exportConfig();
      const blob = new Blob([exportedConfig], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mcpd-config-export.json";
      a.click();
      URL.revokeObjectURL(url);
      message.success("Configuration exported successfully");
    } catch (error) {
      console.error("Failed to export config:", error);
      message.error("Failed to export configuration");
    }
  };

  const hasChanges = configContent !== originalContent;

  return (
    <div>
      <Alert
        message="Configuration File (.mcpd.toml)"
        description="Edit your mcpd configuration directly. Changes will be applied after saving and restarting the daemon."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card
        title="Configuration Editor"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadConfig}
              loading={loading}
            >
              Reload
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportConfig}>
              Export
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveConfig}
              disabled={!hasChanges}
            >
              Save {hasChanges && "*"}
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            Loading configuration...
          </div>
        ) : (
          <MonacoEditor
            height="calc(100vh - 370px)"
            language="toml"
            theme="vs-dark"
            value={configContent}
            onChange={(value) => setConfigContent(value || "")}
            loading={loading}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              wordWrap: "on",
              scrollBeyondLastLine: false,
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
              },
              formatOnPaste: true,
              formatOnType: true,
            }}
          />
        )}
      </Card>

      {hasChanges && (
        <Alert
          message="Unsaved Changes"
          description="You have unsaved changes. Don't forget to save before leaving this page."
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default ConfigEditor;
