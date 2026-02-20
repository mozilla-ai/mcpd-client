import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tabs,
  Tag,
  Switch,
  Checkbox,
  Divider,
  List,
  Typography,
  message,
  Row,
  Col,
  Collapse,
  Empty,
} from "antd";
import {
  CodeOutlined,
  SettingOutlined,
  DatabaseOutlined,
  CloudOutlined,
  GithubOutlined,
  MessageOutlined,
  FileOutlined,
  GlobalOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  FilterOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { RegistryServer, RegistryArgument, RegistryData } from "@shared/types";
import bundledRegistry from "../data/registry.json";
import clientServers from "../data/client-servers.json";

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface AddServerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Wrapper that tracks which source a server came from.
interface TaggedServer extends RegistryServer {
  _source: string;
}

interface ServerFilters {
  category?: string;
  official?: boolean;
  license?: string;
  runtime?: string;
  source?: string;
  tags: string[];
}

const EMPTY_FILTERS: ServerFilters = { tags: [] };

// Simple TOML syntax highlighting for preview blocks.
const TOML_HIGHLIGHT_COLORS = {
  comment: "#6a9955",
  section: "#569cd6",
  key: "#9cdcfe",
  string: "#ce9178",
  keyword: "#569cd6",
  number: "#b5cea8",
  delimiter: "#d4d4d4",
};

// Tokenize a single line into highlighted spans.
function highlightTomlLine(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = line;
  let idx = 0;

  const push = (text: string, color?: string) => {
    if (!text) return;
    nodes.push(
      color ? (
        <span key={idx++} style={{ color }}>
          {text}
        </span>
      ) : (
        <span key={idx++}>{text}</span>
      ),
    );
  };

  // Comment line.
  if (/^\s*#/.test(remaining)) {
    push(remaining, TOML_HIGHLIGHT_COLORS.comment);
    return nodes;
  }

  // Section header: [[...]] or [...].
  const sectionMatch = remaining.match(/^(\s*)(\[\[?.+?\]?\])(.*)$/);
  if (sectionMatch) {
    push(sectionMatch[1]);
    push(sectionMatch[2], TOML_HIGHLIGHT_COLORS.section);
    push(sectionMatch[3]);
    return nodes;
  }

  // Key = value line.
  const kvMatch = remaining.match(/^(\s*)([\w.-]+)(\s*=\s*)(.*)/);
  if (kvMatch) {
    push(kvMatch[1]);
    push(kvMatch[2], TOML_HIGHLIGHT_COLORS.key);
    push(kvMatch[3], TOML_HIGHLIGHT_COLORS.delimiter);
    remaining = kvMatch[4];

    // Highlight the value portion with simple token matching.
    const valTokens =
      remaining.match(
        /("(?:[^"\\]|\\.)*"|'[^']*'|true|false|[+-]?\d+(?:\.\d+)?|\[|\]|,|\s+|[^\s,[\]"']+)/g,
      ) || [];
    for (const token of valTokens) {
      if (/^["']/.test(token)) {
        push(token, TOML_HIGHLIGHT_COLORS.string);
      } else if (/^(true|false)$/.test(token)) {
        push(token, TOML_HIGHLIGHT_COLORS.keyword);
      } else if (/^[+-]?\d+(\.\d+)?$/.test(token)) {
        push(token, TOML_HIGHLIGHT_COLORS.number);
      } else {
        push(token);
      }
    }
    return nodes;
  }

  // Fallback: unhighlighted.
  push(remaining);
  return nodes;
}

// Render TOML content with syntax highlighting.
function HighlightedToml({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {highlightTomlLine(line)}
          {i < lines.length - 1 && "\n"}
        </React.Fragment>
      ))}
    </>
  );
}

// Escape a string for use in a TOML quoted value.
function escapeToml(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

// Convert the bundled JSON into an array of tagged servers.
function registryToArray(data: RegistryData, source: string): TaggedServer[] {
  return Object.values(data)
    .filter((s) => !s.deprecated)
    .map((s) => ({ ...s, _source: source }));
}

// Pre-compute bundled registries once at module level.
const BUNDLED_SERVERS = registryToArray(
  bundledRegistry as RegistryData,
  "mozilla-ai",
);
const CLIENT_SERVERS = registryToArray(
  clientServers as RegistryData,
  "mcpd-client",
);

// Group servers by their first category.
function groupByCategory(
  servers: TaggedServer[],
): Record<string, TaggedServer[]> {
  const groups: Record<string, TaggedServer[]> = {};
  for (const server of servers) {
    const category = server.categories?.[0] ?? "Other";
    if (!groups[category]) groups[category] = [];
    groups[category].push(server);
  }
  return groups;
}

// Filter servers by a search query against name, description, tags, and tools.
function filterByQuery(servers: TaggedServer[], query: string): TaggedServer[] {
  const q = query.toLowerCase();
  return servers.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (s.displayName ?? "").toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags?.some((t) => t.toLowerCase().includes(q)) ||
      s.tools.some((t) => t.name.toLowerCase().includes(q)),
  );
}

// Apply structured filters to a server list.
function applyFilters(
  servers: TaggedServer[],
  filters: ServerFilters,
): TaggedServer[] {
  return servers.filter((s) => {
    if (filters.category && !s.categories?.includes(filters.category)) {
      return false;
    }
    if (filters.official && !s.isOfficial) {
      return false;
    }
    if (
      filters.license &&
      !s.license.toLowerCase().includes(filters.license.toLowerCase())
    ) {
      return false;
    }
    if (
      filters.runtime &&
      !Object.values(s.installations).some(
        (inst) => inst.runtime === filters.runtime,
      )
    ) {
      return false;
    }
    if (filters.source && s._source !== filters.source) {
      return false;
    }
    if (
      filters.tags.length > 0 &&
      !filters.tags.every((ft) =>
        s.tags?.some((st) => st.toLowerCase().includes(ft.toLowerCase())),
      )
    ) {
      return false;
    }
    return true;
  });
}

// Check if a license string looks like a real SPDX identifier.
const INVALID_LICENSE_RE = /not (given|found)|unknown|\[/i;
function isValidLicense(license: string | undefined): license is string {
  return !!license && !INVALID_LICENSE_RE.test(license);
}

// Extract unique values from all servers for filter dropdowns.
function extractFilterOptions(servers: TaggedServer[]) {
  const categories = new Set<string>();
  const licenses = new Set<string>();
  const runtimes = new Set<string>();
  const sources = new Set<string>();
  const tags = new Set<string>();

  for (const s of servers) {
    s.categories?.forEach((c) => categories.add(c));
    if (isValidLicense(s.license)) licenses.add(s.license);
    Object.values(s.installations).forEach((inst) =>
      runtimes.add(inst.runtime),
    );
    sources.add(s._source);
    s.tags?.forEach((t) => tags.add(t));
  }

  return {
    categories: Array.from(categories).sort(),
    licenses: Array.from(licenses).sort(),
    runtimes: Array.from(runtimes).sort(),
    sources: Array.from(sources).sort(),
    tags: Array.from(tags).sort(),
  };
}

// Processed arguments matching mcpd's ServerEntry TOML fields.
interface ProcessedArgs {
  requiredEnv: string[];
  requiredArgs: string[];
  requiredArgsBool: string[];
  requiredArgsPositional: string[];
}

// Shared argument processing: maps registry arguments to mcpd config fields.
// When argValues is provided, optional args with user-entered values are included.
function processArguments(
  serverArgs: Record<string, RegistryArgument> | undefined,
  argValues?: Record<string, string | boolean>,
): ProcessedArgs {
  const requiredEnv: string[] = [];
  const requiredArgs: string[] = [];
  const requiredArgsBool: string[] = [];
  const positional: { position: number; name: string }[] = [];

  for (const [, arg] of Object.entries(serverArgs ?? {})) {
    const userValue = argValues?.[arg.name];
    const hasValue =
      userValue !== undefined && userValue !== "" && userValue !== false;
    if (!arg.required && !hasValue) continue;

    switch (arg.type) {
      case "environment":
        requiredEnv.push(arg.name);
        break;
      case "argument":
        requiredArgs.push(arg.name);
        break;
      case "argument_bool":
        requiredArgsBool.push(arg.name);
        break;
      case "argument_positional":
        positional.push({ position: arg.position ?? 0, name: arg.name });
        break;
      case "volume":
        // Handled separately via volumes config.
        break;
    }
  }

  return {
    requiredEnv,
    requiredArgs,
    requiredArgsBool,
    requiredArgsPositional: positional
      .sort((a, b) => a.position - b.position)
      .map((a) => a.name),
  };
}

// Build the package identifier including version: runtime::package@version.
function buildPackageId(installation: {
  runtime: string;
  package: string;
  version?: string;
}): string {
  const base = `${installation.runtime}::${installation.package}`;
  return installation.version ? `${base}@${installation.version}` : base;
}

// Build the secrets TOML preview showing what will be written to secrets.dev.toml.
// Environment values are masked unless their field is toggled visible.
function buildSecretsPreview(
  serverId: string,
  serverArgs: Record<string, RegistryArgument> | undefined,
  argValues: Record<string, string | boolean>,
  visibleFields: Set<string>,
): string {
  if (!serverArgs || Object.keys(argValues).length === 0) return "";

  const envLines: string[] = [];
  const positionalArgs: { position: number; value: string }[] = [];
  const cliArgs: string[] = [];

  for (const [, arg] of Object.entries(serverArgs)) {
    const value = argValues[arg.name];
    if (value === undefined || value === "" || value === false) continue;

    switch (arg.type) {
      case "environment": {
        const display = visibleFields.has(arg.name)
          ? `"${escapeToml(value as string)}"`
          : '"********"';
        envLines.push(`  ${arg.name} = ${display}`);
        break;
      }
      case "argument":
        cliArgs.push(`${arg.name}=${value}`);
        break;
      case "argument_bool":
        if (value) cliArgs.push(arg.name);
        break;
      case "argument_positional":
        positionalArgs.push({
          position: arg.position ?? 0,
          value: value as string,
        });
        break;
    }
  }

  const sortedPositional = positionalArgs
    .sort((a, b) => a.position - b.position)
    .map((a) => a.value);
  const allArgs = [...sortedPositional, ...cliArgs];

  if (envLines.length === 0 && allArgs.length === 0) return "";

  let preview = "";
  if (allArgs.length > 0) {
    const argsArr = allArgs.map((a) => `"${escapeToml(a)}"`).join(", ");
    preview += `[servers.${serverId}]\n`;
    preview += `  args = [${argsArr}]\n`;
  }
  if (envLines.length > 0) {
    if (allArgs.length === 0) {
      // Still need the server section header for env.
      preview += `[servers.${serverId}]\n`;
    }
    preview += `\n[servers.${serverId}.env]\n`;
    preview += envLines.join("\n") + "\n";
  }

  return preview;
}

// Generate mcpd TOML matching the ServerEntry struct.
function generateToml(
  server: RegistryServer,
  runtimeKey: string,
  selectedTools: string[],
  argValues?: Record<string, string | boolean>,
): string {
  const installation = server.installations[runtimeKey];
  if (!installation) return "# No installation found for this runtime";

  const tomlArr = (items: string[]) =>
    `[${items.map((i) => `"${escapeToml(i)}"`).join(", ")}]`;

  let toml = "[[servers]]\n";
  toml += `  name = "${escapeToml(server.id)}"\n`;
  toml += `  package = "${escapeToml(buildPackageId(installation))}"\n`;
  toml += `  tools = ${tomlArr(selectedTools)}\n`;

  const processed = processArguments(server.arguments, argValues);

  if (processed.requiredEnv.length > 0) {
    toml += `  required_env = ${tomlArr(processed.requiredEnv)}\n`;
  }
  if (processed.requiredArgs.length > 0) {
    toml += `  required_args = ${tomlArr(processed.requiredArgs)}\n`;
  }
  if (processed.requiredArgsBool.length > 0) {
    toml += `  required_args_bool = ${tomlArr(processed.requiredArgsBool)}\n`;
  }
  if (processed.requiredArgsPositional.length > 0) {
    toml += `  required_args_positional = ${tomlArr(processed.requiredArgsPositional)}\n`;
  }

  return toml;
}

const AddServerModal: React.FC<AddServerModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [mode, setMode] = useState<"browse" | "custom">("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ServerFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedServer, setSelectedServer] = useState<TaggedServer | null>(
    null,
  );
  const [selectedRuntime, setSelectedRuntime] = useState<string>("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [configPreview, setConfigPreview] = useState("");
  const [secretsPreview, setSecretsPreview] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [secretsPath, setSecretsPath] = useState("");
  const [adding, setAdding] = useState(false);
  const [argValues, setArgValues] = useState<Record<string, string | boolean>>(
    {},
  );
  const [visibleEnvFields, setVisibleEnvFields] = useState<Set<string>>(
    new Set(),
  );
  // Registry data: bundled snapshot, overlaid with live search results.
  const [liveServers, setLiveServers] = useState<TaggedServer[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);

  // Merge bundled + client-specific + live data. For duplicate IDs, prefer
  // mozilla-ai entries over other sources (e.g. mcpm).
  const allServers = useMemo(() => {
    const merged = new Map<string, TaggedServer>();
    const setIfBetter = (s: TaggedServer) => {
      const existing = merged.get(s.id);
      if (!existing || s._source === "mozilla-ai") {
        merged.set(s.id, s);
      }
    };
    for (const s of BUNDLED_SERVERS) setIfBetter(s);
    for (const s of CLIENT_SERVERS) setIfBetter(s);
    for (const s of liveServers) setIfBetter(s);
    return Array.from(merged.values());
  }, [liveServers]);

  // Extract unique values for filter dropdowns.
  const filterOptions = useMemo(
    () => extractFilterOptions(allServers),
    [allServers],
  );

  // Count active filters for the badge.
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.official) count++;
    if (filters.license) count++;
    if (filters.runtime) count++;
    if (filters.source) count++;
    count += filters.tags.length;
    return count;
  }, [filters]);

  const filteredServers = useMemo(() => {
    let result = allServers;
    if (searchQuery) result = filterByQuery(result, searchQuery);
    result = applyFilters(result, filters);
    return result;
  }, [allServers, searchQuery, filters]);

  const serversByCategory = useMemo(
    () => groupByCategory(filteredServers),
    [filteredServers],
  );

  const fetchLiveRegistry = async () => {
    setLoadingLive(true);
    try {
      const results = await window.electronAPI.searchServers("*");
      if (Array.isArray(results)) {
        setLiveServers(
          results.map((s: RegistryServer & { source?: string }) => ({
            ...s,
            _source: s.source || "unknown",
          })),
        );
      }
    } catch {
      // Daemon may not be running; bundled data is sufficient.
    } finally {
      setLoadingLive(false);
    }
  };

  // Fetch live registry and file paths when modal opens.
  useEffect(() => {
    if (visible) {
      fetchLiveRegistry();
      window.electronAPI
        .getConfigPath()
        .then(setConfigPath)
        .catch(console.error);
      window.electronAPI
        .getSecretsPath()
        .then(setSecretsPath)
        .catch(console.error);
    } else {
      // Reset all state when modal closes.
      form.resetFields();
      setMode("browse");
      setSelectedServer(null);
      setSelectedRuntime("");
      setSelectedTools([]);
      setArgValues({});
      setSearchQuery("");
      setFilters(EMPTY_FILTERS);
      setShowFilters(false);
      setConfigPreview("");
      setSecretsPreview("");
      setVisibleEnvFields(new Set());
    }
  }, [visible, form]);

  // Regenerate TOML previews when relevant state changes.
  useEffect(() => {
    if (selectedServer && selectedRuntime) {
      setConfigPreview(
        generateToml(selectedServer, selectedRuntime, selectedTools, argValues),
      );
      setSecretsPreview(
        buildSecretsPreview(
          selectedServer.id,
          selectedServer.arguments,
          argValues,
          visibleEnvFields,
        ),
      );
    } else {
      setConfigPreview("");
      setSecretsPreview("");
    }
  }, [
    selectedServer,
    selectedRuntime,
    selectedTools,
    argValues,
    visibleEnvFields,
  ]);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      Development: <GithubOutlined />,
      Databases: <DatabaseOutlined />,
      "Cloud Storage": <CloudOutlined />,
      Messaging: <MessageOutlined />,
      "System Tools": <FileOutlined />,
      "Web Services": <GlobalOutlined />,
      Productivity: <SettingOutlined />,
      "Knowledge Base": <DatabaseOutlined />,
    };
    return icons[category] || <CodeOutlined />;
  };

  const selectServer = (server: TaggedServer) => {
    setSelectedServer(server);
    setArgValues({});
    setVisibleEnvFields(new Set());

    // Pick the recommended or first installation.
    const entries = Object.entries(server.installations);
    if (entries.length === 0) {
      setSelectedRuntime("");
      setSelectedTools(server.tools.map((t) => t.name));
      return;
    }
    const recommended = entries.find(([, inst]) => inst.recommended);
    const [runtimeKey, installation] = recommended ?? entries[0];
    setSelectedRuntime(runtimeKey);

    // Auto-select all tools.
    setSelectedTools(server.tools.map((t) => t.name));

    // Pre-fill form.
    form.setFieldsValue({
      name: server.id,
      package: buildPackageId(installation),
    });
  };

  const updateFilter = (key: keyof ServerFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const handleAdd = async () => {
    if (!selectedServer && mode === "browse") return;

    try {
      setAdding(true);

      if (mode === "custom") {
        // Custom mode: use form values directly.
        const values = await form.validateFields();
        const serverConfig = {
          name: values.name,
          package: values.package,
          tools: selectedTools,
        };
        await window.electronAPI.addServer(serverConfig);
        message.success(`Server ${values.name} added successfully`);
      } else {
        // Browse mode: use mcpd CLI to add the server from the registry.
        const installation = selectedServer!.installations[selectedRuntime];
        if (!installation) {
          message.error("No installation found for selected runtime");
          return;
        }

        await window.electronAPI.addServerFromRegistry(
          selectedServer!.id,
          installation.runtime,
          installation.version || "",
          selectedTools,
        );

        // Save user-entered env/args via mcpd CLI.
        // Non-fatal: server config is already saved, so warn instead of failing.
        if (selectedServer!.arguments && Object.keys(argValues).length > 0) {
          try {
            const env: Record<string, string> = {};
            const positionalArgs: string[] = [];
            const cliArgs: string[] = [];
            const boolArgs: string[] = [];
            const positionalEntries: { position: number; value: string }[] = [];

            for (const [, arg] of Object.entries(selectedServer!.arguments)) {
              const value = argValues[arg.name];
              if (value === undefined || value === "" || value === false)
                continue;

              switch (arg.type) {
                case "environment":
                  env[arg.name] = value as string;
                  break;
                case "argument":
                  cliArgs.push(`${arg.name}=${value}`);
                  break;
                case "argument_bool":
                  if (value) boolArgs.push(arg.name);
                  break;
                case "argument_positional":
                  positionalEntries.push({
                    position: arg.position ?? 0,
                    value: value as string,
                  });
                  break;
              }
            }

            positionalEntries
              .sort((a, b) => a.position - b.position)
              .forEach((a) => positionalArgs.push(a.value));

            if (Object.keys(env).length > 0) {
              await window.electronAPI.setServerEnv(selectedServer!.id, env);
            }
            if (
              positionalArgs.length > 0 ||
              cliArgs.length > 0 ||
              boolArgs.length > 0
            ) {
              await window.electronAPI.setServerArgs(
                selectedServer!.id,
                positionalArgs,
                cliArgs,
                boolArgs,
              );
            }
          } catch (err: any) {
            console.error("Failed to save secrets:", err);
            const errorDetail = err?.message || String(err);
            const serverId = selectedServer!.id;
            Modal.confirm({
              title: "Server added with errors",
              content: (
                <div>
                  <p>
                    The server was added to your config, but saving
                    environment/argument values failed. You can keep the server
                    and configure secrets manually, or remove it and try again.
                  </p>
                  <pre
                    style={{
                      background: "#f5f5f5",
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {errorDetail}
                  </pre>
                </div>
              ),
              okText: "Keep Server",
              cancelText: "Remove Server",
              onOk: () => {
                onSuccess();
                onClose();
              },
              onCancel: async () => {
                try {
                  await window.electronAPI.removeServer(serverId);
                  message.info(`Server ${serverId} removed`);
                  onSuccess();
                  onClose();
                } catch (removeErr: any) {
                  message.error(
                    `Failed to remove server: ${removeErr?.message || removeErr}`,
                  );
                }
              },
            });
            // Return early so the success toast and modal close are
            // deferred until the user picks "Keep" or "Remove".
            return;
          }
        }

        message.success(
          `Server ${selectedServer!.displayName ?? selectedServer!.name} added successfully`,
        );
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to add server:", error);
      message.error(error.message || "Failed to add server");
    } finally {
      setAdding(false);
    }
  };

  const updateArgValue = (name: string, value: string | boolean) => {
    setArgValues((prev) => ({ ...prev, [name]: value }));
  };

  const renderArgumentField = (key: string, arg: RegistryArgument) => {
    const typeColor =
      arg.type === "environment"
        ? "orange"
        : arg.type === "argument_bool"
          ? "cyan"
          : "default";

    return (
      <div key={key} style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 4 }}>
          <Space>
            <Text strong>{arg.name}</Text>
            {arg.required && <Tag color="red">Required</Tag>}
            <Tag color={typeColor}>{arg.type}</Tag>
          </Space>
        </div>
        <Text
          type="secondary"
          style={{ fontSize: 12, display: "block", marginBottom: 4 }}
        >
          {arg.description}
        </Text>
        {arg.type === "volume" ? (
          <Input
            size="small"
            disabled
            placeholder="Volume mounts are configured via Docker"
            value={arg.path || ""}
          />
        ) : arg.type === "argument_bool" ? (
          <Switch
            checked={!!argValues[arg.name]}
            onChange={(checked) => updateArgValue(arg.name, checked)}
            size="small"
          />
        ) : arg.type === "environment" ? (
          <Input.Password
            size="small"
            placeholder={arg.example || `Enter ${arg.name}`}
            value={(argValues[arg.name] as string) || ""}
            onChange={(e) => updateArgValue(arg.name, e.target.value)}
            visibilityToggle={{
              visible: visibleEnvFields.has(arg.name),
              onVisibleChange: (v) => {
                setVisibleEnvFields((prev) => {
                  const next = new Set(prev);
                  if (v) {
                    next.add(arg.name);
                  } else {
                    next.delete(arg.name);
                  }
                  return next;
                });
              },
            }}
          />
        ) : (
          <Input
            size="small"
            placeholder={arg.example || `Enter ${arg.name}`}
            value={(argValues[arg.name] as string) || ""}
            onChange={(e) => updateArgValue(arg.name, e.target.value)}
          />
        )}
      </div>
    );
  };

  const renderServerListItem = (server: TaggedServer) => (
    <List.Item
      onClick={() => selectServer(server)}
      style={{
        cursor: "pointer",
        padding: 12,
        borderRadius: 4,
        marginBottom: 8,
      }}
    >
      <List.Item.Meta
        title={
          <Space>
            {server.displayName ?? server.name}
            {server.isOfficial && (
              <Tag color="blue" icon={<SafetyCertificateOutlined />}>
                Official
              </Tag>
            )}
            {server.categories?.map((c) => (
              <Tag key={c} color="default">
                {c}
              </Tag>
            ))}
          </Space>
        }
        description={
          <div>
            <Paragraph
              ellipsis={{ rows: 2 }}
              style={{ marginBottom: 4, fontSize: 13 }}
            >
              {server.description}
            </Paragraph>
            {server.tools.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <Space wrap size={[4, 4]}>
                  {server.tools.map((tool) => (
                    <Tag
                      key={tool.name}
                      color="geekblue"
                      style={{ fontSize: 11, margin: 0 }}
                    >
                      {tool.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
            <Space wrap size={[4, 4]}>
              {Object.entries(server.installations).flatMap(
                ([instKey, inst]) => {
                  const tags = [
                    <Tag
                      key={instKey}
                      color="green"
                      style={{ fontSize: 11, margin: 0 }}
                    >
                      {inst.runtime}
                    </Tag>,
                  ];
                  if (inst.version) {
                    tags.push(
                      <Tag
                        key={`ver-${instKey}`}
                        color="blue"
                        style={{ fontSize: 11, margin: 0 }}
                      >
                        v{inst.version}
                      </Tag>,
                    );
                  }
                  return tags;
                },
              )}
              {isValidLicense(server.license) && (
                <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>
                  {server.license}
                </Tag>
              )}
              <Tag color="cyan" style={{ fontSize: 11, margin: 0 }}>
                {server._source}
              </Tag>
            </Space>
          </div>
        }
      />
    </List.Item>
  );

  const renderFilterBar = () => (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid #f0f0f0",
        marginBottom: 12,
      }}
    >
      <Row gutter={[8, 8]}>
        <Col span={5}>
          <Select
            placeholder="Category"
            allowClear
            style={{ width: "100%" }}
            size="small"
            value={filters.category}
            onChange={(v) => updateFilter("category", v)}
          >
            {filterOptions.categories.map((c) => (
              <Select.Option key={c} value={c}>
                {c}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            placeholder="Source"
            allowClear
            style={{ width: "100%" }}
            size="small"
            value={filters.source}
            onChange={(v) => updateFilter("source", v)}
          >
            {filterOptions.sources.map((s) => (
              <Select.Option key={s} value={s}>
                {s}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            placeholder="Runtime"
            allowClear
            style={{ width: "100%" }}
            size="small"
            value={filters.runtime}
            onChange={(v) => updateFilter("runtime", v)}
          >
            {filterOptions.runtimes.map((r) => (
              <Select.Option key={r} value={r}>
                {r}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            placeholder="License"
            allowClear
            style={{ width: "100%" }}
            size="small"
            value={filters.license}
            onChange={(v) => updateFilter("license", v)}
          >
            {filterOptions.licenses.map((l) => (
              <Select.Option key={l} value={l}>
                {l}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            placeholder="Tags"
            mode="multiple"
            allowClear
            style={{ width: "100%" }}
            size="small"
            maxTagCount={1}
            value={filters.tags}
            onChange={(v) => updateFilter("tags", v)}
          >
            {filterOptions.tags.map((t) => (
              <Select.Option key={t} value={t}>
                {t}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={3}>
          <Checkbox
            checked={filters.official ?? false}
            onChange={(e) =>
              updateFilter("official", e.target.checked || undefined)
            }
          >
            <Text style={{ fontSize: 12 }}>Official</Text>
          </Checkbox>
        </Col>
      </Row>
      {activeFilterCount > 0 && (
        <div style={{ marginTop: 8 }}>
          <Button
            type="link"
            size="small"
            onClick={clearFilters}
            style={{ padding: 0 }}
          >
            Clear all filters ({activeFilterCount} active)
          </Button>
        </div>
      )}
    </div>
  );

  const renderBrowseMode = () => (
    <div>
      {!selectedServer && (
        <>
          <Space
            style={{ width: "100%", marginBottom: 8 }}
            direction="vertical"
          >
            <Space style={{ width: "100%" }}>
              <Input.Search
                placeholder="Search servers by name, description, tool, or tag..."
                onChange={(e) => setSearchQuery(e.target.value)}
                value={searchQuery}
                allowClear
                style={{ flex: 1 }}
              />
              <Button
                icon={<FilterOutlined />}
                onClick={() => setShowFilters(!showFilters)}
                type={activeFilterCount > 0 ? "primary" : "default"}
                size="middle"
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
            </Space>
            {showFilters && renderFilterBar()}
            {loadingLive && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <LoadingOutlined /> Loading live registry from daemon...
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {filteredServers.length} server
              {filteredServers.length !== 1 ? "s" : ""}
              {searchQuery || activeFilterCount > 0
                ? " matching"
                : " available"}
            </Text>
          </Space>

          {filteredServers.length === 0 ? (
            <Empty
              description={
                searchQuery || activeFilterCount > 0
                  ? "No servers match the current filters"
                  : "No servers available"
              }
            />
          ) : (
            <div style={{ maxHeight: 400, overflow: "auto" }}>
              {searchQuery || activeFilterCount > 0 ? (
                <List
                  dataSource={filteredServers}
                  renderItem={renderServerListItem}
                />
              ) : (
                <Collapse
                  defaultActiveKey={Object.keys(serversByCategory)}
                  ghost
                >
                  {Object.entries(serversByCategory).map(
                    ([category, servers]) => (
                      <Collapse.Panel
                        key={category}
                        header={
                          <Space>
                            {getCategoryIcon(category)}
                            <Text strong>{category}</Text>
                            <Tag>{servers.length} servers</Tag>
                          </Space>
                        }
                      >
                        <List
                          dataSource={servers}
                          renderItem={renderServerListItem}
                        />
                      </Collapse.Panel>
                    ),
                  )}
                </Collapse>
              )}
            </div>
          )}
        </>
      )}

      {selectedServer && (
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedServer(null)}
            style={{ marginBottom: 12, paddingLeft: 0 }}
          >
            Back to servers
          </Button>

          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong style={{ fontSize: 16 }}>
                {selectedServer.displayName ?? selectedServer.name}
              </Text>
              {selectedServer.isOfficial && (
                <Tag color="blue" icon={<SafetyCertificateOutlined />}>
                  Official
                </Tag>
              )}
            </Space>
            <Paragraph
              type="secondary"
              style={{ marginBottom: 4, marginTop: 4 }}
            >
              {selectedServer.description}
            </Paragraph>
            {selectedServer.tags && selectedServer.tags.length > 0 && (
              <Space wrap size={[4, 4]}>
                {selectedServer.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </Space>
            )}
          </div>

          <Form form={form} layout="vertical">
            <Form.Item name="name" label="Server Name">
              <Input disabled />
            </Form.Item>

            <Form.Item
              name="package"
              label={
                <Space>
                  Package
                  {selectedRuntime &&
                    selectedServer.installations[selectedRuntime]?.version && (
                      <Tag color="blue">
                        v{selectedServer.installations[selectedRuntime].version}
                      </Tag>
                    )}
                </Space>
              }
            >
              {Object.keys(selectedServer.installations).length > 1 ? (
                <Select
                  value={selectedRuntime}
                  onChange={(value) => {
                    setSelectedRuntime(value);
                    const inst = selectedServer.installations[value];
                    form.setFieldValue("package", buildPackageId(inst));
                  }}
                >
                  {Object.entries(selectedServer.installations).map(
                    ([key, inst]) => (
                      <Select.Option key={key} value={key}>
                        {inst.runtime}: {inst.package}@{inst.version}
                        {inst.recommended ? " (Recommended)" : ""}
                      </Select.Option>
                    ),
                  )}
                </Select>
              ) : (
                <Input disabled />
              )}
            </Form.Item>

            {selectedServer.tools.length > 0 && (
              <Form.Item label="Tools">
                <Checkbox.Group
                  value={selectedTools}
                  onChange={(values) => setSelectedTools(values as string[])}
                  style={{ width: "100%" }}
                >
                  <Row>
                    {selectedServer.tools.map((tool) => (
                      <Col span={12} key={tool.name}>
                        <Checkbox value={tool.name}>
                          <span title={tool.description}>{tool.name}</span>
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>
            )}

            {selectedServer.arguments &&
              Object.keys(selectedServer.arguments).length > 0 && (
                <>
                  <Divider orientation="left">Configuration Values</Divider>
                  <Text
                    type="secondary"
                    style={{
                      display: "block",
                      marginBottom: 12,
                      fontSize: 12,
                    }}
                  >
                    These values will be saved to your secrets file
                    (~/.config/mcpd/secrets.dev.toml).
                  </Text>
                  {Object.entries(selectedServer.arguments).map(([key, arg]) =>
                    renderArgumentField(key, arg),
                  )}
                </>
              )}
          </Form>

          {configPreview && (
            <Collapse
              defaultActiveKey={["config-preview", "secrets-preview"]}
              style={{ marginTop: 16 }}
            >
              <Collapse.Panel
                key="config-preview"
                header={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <FileOutlined style={{ marginRight: 6 }} />
                    {configPath || ".mcpd.toml"}
                  </Text>
                }
              >
                <pre
                  style={{
                    background: "#1e1e1e",
                    color: "#d4d4d4",
                    fontFamily: "monospace",
                    fontSize: 12,
                    padding: 12,
                    borderRadius: 4,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  <HighlightedToml content={configPreview} />
                </pre>
              </Collapse.Panel>
              {secretsPreview && (
                <Collapse.Panel
                  key="secrets-preview"
                  header={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <FileOutlined style={{ marginRight: 6 }} />
                      {secretsPath || "secrets.dev.toml"}
                    </Text>
                  }
                >
                  <pre
                    style={{
                      background: "#1e1e1e",
                      color: "#d4d4d4",
                      fontFamily: "monospace",
                      fontSize: 12,
                      padding: 12,
                      borderRadius: 4,
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    <HighlightedToml content={secretsPreview} />
                  </pre>
                </Collapse.Panel>
              )}
            </Collapse>
          )}
        </div>
      )}
    </div>
  );

  const renderCustomMode = () => (
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="Server Name"
        rules={[{ required: true, message: "Please enter a server name" }]}
      >
        <Input placeholder="e.g., my-custom-server" />
      </Form.Item>

      <Form.Item
        name="package"
        label="Package"
        rules={[{ required: true, message: "Please enter a package" }]}
        help="Format: runtime::package@version (e.g., npx::my-server@1.0.0)"
      >
        <Input placeholder="e.g., uvx::my-custom-server@1.0.0" />
      </Form.Item>

      <Form.Item
        name="toolsList"
        label="Tools (comma-separated)"
        help="List the tools this server provides"
      >
        <TextArea
          rows={2}
          placeholder="e.g., read_file, write_file, list_directory"
          onChange={(e) => {
            const tools = e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            setSelectedTools(tools);
          }}
        />
      </Form.Item>
    </Form>
  );

  return (
    <Modal
      title="Add MCP Server"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="add"
          type="primary"
          loading={adding}
          onClick={handleAdd}
          disabled={mode === "browse" ? !selectedServer : false}
        >
          Add Server
        </Button>,
      ]}
    >
      <Tabs
        activeKey={mode}
        onChange={(key) => setMode(key as "browse" | "custom")}
      >
        <TabPane tab="Browse Registry" key="browse">
          {renderBrowseMode()}
        </TabPane>
        <TabPane tab="Custom Server" key="custom">
          {renderCustomMode()}
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default AddServerModal;
