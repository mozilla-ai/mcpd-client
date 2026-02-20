import React, { useState, useEffect } from "react";
import { Card, Button, Space, message, Alert, Typography } from "antd";
import {
  SaveOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";

const { Text } = Typography;

const ConfigEditor: React.FC = () => {
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;
    // Only register TOML once (idempotent guard for remounts).
    const registered = monaco.languages
      .getLanguages()
      .some((lang) => lang.id === "toml");
    if (registered) return;
    monaco.languages.register({ id: "toml" });
    monaco.languages.setMonarchTokensProvider("toml", {
      tokenizer: {
        root: [
          [/#.*$/, "comment"],
          [/\[\[[\w.-]+\]\]/, "type.identifier"],
          [/\[[\w.-]+\]/, "type.identifier"],
          [/[a-zA-Z_][\w-]*(?=\s*=)/, "variable"],
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

  const [secretsContent, setSecretsContent] = useState<string>("");
  const [originalSecretsContent, setOriginalSecretsContent] =
    useState<string>("");
  const [secretsLoading, setSecretsLoading] = useState(false);

  const [configPath, setConfigPath] = useState<string>("");
  const [secretsPath, setSecretsPath] = useState<string>("");

  useEffect(() => {
    loadConfig();
    loadSecrets();
    window.electronAPI.getConfigPath().then(setConfigPath).catch(console.error);
    window.electronAPI
      .getSecretsPath()
      .then(setSecretsPath)
      .catch(console.error);
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await window.electronAPI.loadConfig();
      const content = config.content || "servers = []";
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

  const loadSecrets = async () => {
    setSecretsLoading(true);
    try {
      const result = await window.electronAPI.loadSecretsContent();
      setSecretsContent(result.content);
      setOriginalSecretsContent(result.content);
    } catch (error) {
      console.error("Failed to load secrets:", error);
      message.error("Failed to load secrets file");
    } finally {
      setSecretsLoading(false);
    }
  };

  const saveSecrets = async () => {
    try {
      await window.electronAPI.saveSecretsContent(secretsContent);
      setOriginalSecretsContent(secretsContent);
      message.success("Secrets saved successfully");
    } catch (error) {
      console.error("Failed to save secrets:", error);
      message.error("Failed to save secrets file");
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

  const hasConfigChanges = configContent !== originalContent;
  const hasSecretsChanges = secretsContent !== originalSecretsContent;
  const hasChanges = hasConfigChanges || hasSecretsChanges;

  return (
    <div>
      <Alert
        message="Configuration Files"
        description="Edit your mcpd configuration and secrets directly. Changes will be applied after saving and restarting the daemon."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card
        title={
          <Space>
            <span>Config</span>
            {configPath && (
              <Text
                type="secondary"
                style={{ fontSize: 12, fontWeight: "normal" }}
              >
                {configPath}
              </Text>
            )}
          </Space>
        }
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
              disabled={!hasConfigChanges}
            >
              Save {hasConfigChanges && "*"}
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
            height="30vh"
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

      <Card
        title={
          <Space>
            <span>Secrets</span>
            {secretsPath && (
              <Text
                type="secondary"
                style={{ fontSize: 12, fontWeight: "normal" }}
              >
                {secretsPath}
              </Text>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSecrets}
              loading={secretsLoading}
            >
              Reload
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveSecrets}
              disabled={!hasSecretsChanges}
            >
              Save {hasSecretsChanges && "*"}
            </Button>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        {secretsLoading ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            Loading secrets...
          </div>
        ) : (
          <MonacoEditor
            height="30vh"
            language="toml"
            theme="vs-dark"
            value={secretsContent}
            onChange={(value) => setSecretsContent(value || "")}
            loading={secretsLoading}
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
