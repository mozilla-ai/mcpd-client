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
  Checkbox,
  Divider,
  List,
  Typography,
  message,
  Card,
  Row,
  Col,
  Collapse,
  Empty,
  Switch,
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
} from "@ant-design/icons";
import MonacoEditor from "@monaco-editor/react";
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

// Shared argument processing: extracts env, positional, and named args from form values.
function processArguments(
  serverArgs: Record<string, RegistryArgument> | undefined,
  argValues: Record<string, string>,
): { envVars: Record<string, string>; args: string[] } {
  const envVars: Record<string, string> = {};
  const positionalArgs: { position: number; value: string }[] = [];
  const namedArgs: string[] = [];

  for (const [key, arg] of Object.entries(serverArgs ?? {})) {
    const value = argValues[key] ?? "";
    if (!value && !arg.required) continue;

    switch (arg.type) {
      case "environment":
        envVars[arg.name] = value;
        break;
      case "argument":
        namedArgs.push(arg.name, value);
        break;
      case "argument_bool":
        if (value === "true") namedArgs.push(arg.name);
        break;
      case "argument_positional":
        positionalArgs.push({ position: arg.position ?? 0, value });
        break;
      case "volume":
        // Skip for non-Docker runtimes.
        break;
    }
  }

  const args = [
    ...positionalArgs
      .sort((a, b) => a.position - b.position)
      .map((a) => a.value)
      .filter(Boolean),
    ...namedArgs,
  ];

  return { envVars, args };
}

// Generate correct mcpd TOML from registry data and form values.
function generateToml(
  server: RegistryServer,
  runtimeKey: string,
  argValues: Record<string, string>,
  selectedTools: string[],
): string {
  const installation = server.installations[runtimeKey];
  if (!installation) return "# No installation found for this runtime";

  const pkg = `${installation.runtime}::${installation.package}`;

  let toml = "[[servers]]\n";
  toml += `name = "${escapeToml(server.id)}"\n`;
  toml += `package = "${escapeToml(pkg)}"\n`;

  if (selectedTools.length > 0 && selectedTools.length < server.tools.length) {
    toml += `tools = [${selectedTools.map((t) => `"${escapeToml(t)}"`).join(", ")}]\n`;
  }

  const { envVars, args } = processArguments(server.arguments, argValues);

  if (Object.keys(envVars).length > 0) {
    const pairs = Object.entries(envVars)
      .map(([k, v]) => `${k} = "${escapeToml(v)}"`)
      .join(", ");
    toml += `env = { ${pairs} }\n`;
  }

  if (args.length > 0) {
    toml += `args = [${args.map((a) => `"${escapeToml(a)}"`).join(", ")}]\n`;
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
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [tomlPreview, setTomlPreview] = useState("");
  const [adding, setAdding] = useState(false);

  // Registry data: bundled snapshot, overlaid with live search results.
  const [liveServers, setLiveServers] = useState<TaggedServer[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);

  // Merge bundled + client-specific + live data (live wins on ID conflicts).
  const allServers = useMemo(() => {
    const merged = new Map<string, TaggedServer>();
    for (const s of BUNDLED_SERVERS) merged.set(s.id, s);
    for (const s of CLIENT_SERVERS) merged.set(s.id, s);
    for (const s of liveServers) merged.set(s.id, s);
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
        setLiveServers(results.map((s) => ({ ...s, _source: "mozilla-ai" })));
      }
    } catch {
      // Daemon may not be running; bundled data is sufficient.
    } finally {
      setLoadingLive(false);
    }
  };

  // Fetch live registry from daemon when modal opens.
  useEffect(() => {
    if (visible) {
      fetchLiveRegistry();
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
      setTomlPreview("");
    }
  }, [visible, form]);

  // Regenerate TOML preview when relevant state changes.
  useEffect(() => {
    if (selectedServer && selectedRuntime) {
      setTomlPreview(
        generateToml(selectedServer, selectedRuntime, argValues, selectedTools),
      );
    } else {
      setTomlPreview("");
    }
  }, [selectedServer, selectedRuntime, argValues, selectedTools]);

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

    // Pick the recommended or first installation.
    const entries = Object.entries(server.installations);
    if (entries.length === 0) {
      setSelectedRuntime("");
      setSelectedTools(server.tools.map((t) => t.name));
      setArgValues({});
      return;
    }
    const recommended = entries.find(([, inst]) => inst.recommended);
    const [runtimeKey, installation] = recommended ?? entries[0];
    setSelectedRuntime(runtimeKey);

    // Auto-select all tools.
    setSelectedTools(server.tools.map((t) => t.name));

    // Initialize argument values with examples.
    const initialArgs: Record<string, string> = {};
    for (const [key, arg] of Object.entries(server.arguments ?? {})) {
      initialArgs[key] = arg.example ?? "";
    }
    setArgValues(initialArgs);

    // Pre-fill form.
    form.setFieldsValue({
      name: server.id,
      package: `${installation.runtime}::${installation.package}`,
    });
  };

  const updateArgValue = (key: string, value: string) => {
    setArgValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateFilter = (key: keyof ServerFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  // Validate that all required arguments have values.
  const validateRequiredArgs = (): string | null => {
    if (!selectedServer?.arguments) return null;
    for (const [key, arg] of Object.entries(selectedServer.arguments)) {
      if (arg.required && !(argValues[key] ?? "").trim()) {
        return `${arg.name} is required`;
      }
    }
    return null;
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
        // Validate required arguments before submitting.
        const validationError = validateRequiredArgs();
        if (validationError) {
          message.error(validationError);
          return;
        }

        // Browse mode: build config from registry data + argument values.
        const installation = selectedServer!.installations[selectedRuntime];
        if (!installation) {
          message.error("No installation found for selected runtime");
          return;
        }
        const pkg = `${installation.runtime}::${installation.package}`;

        const { envVars, args } = processArguments(
          selectedServer!.arguments,
          argValues,
        );

        const serverConfig: Record<string, unknown> = {
          name: selectedServer!.id,
          package: pkg,
        };
        if (
          selectedTools.length > 0 &&
          selectedTools.length < selectedServer!.tools.length
        ) {
          serverConfig.tools = selectedTools;
        }
        if (Object.keys(envVars).length > 0) {
          serverConfig.env = envVars;
        }
        if (args.length > 0) {
          serverConfig.args = args;
        }

        await window.electronAPI.addServer(serverConfig);
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

  const renderArgumentField = (key: string, arg: RegistryArgument) => {
    if (arg.type === "argument_bool") {
      return (
        <Form.Item
          key={key}
          label={
            <Space>
              {arg.name}
              {arg.required && <Tag color="red">Required</Tag>}
              <Tag>{arg.type}</Tag>
            </Space>
          }
          help={arg.description}
        >
          <Switch
            checked={argValues[key] === "true"}
            onChange={(checked) => updateArgValue(key, checked ? "true" : "")}
          />
        </Form.Item>
      );
    }

    if (arg.type === "environment") {
      return (
        <Form.Item
          key={key}
          label={
            <Space>
              {arg.name}
              {arg.required && <Tag color="red">Required</Tag>}
              <Tag color="orange">env</Tag>
            </Space>
          }
          help={arg.description}
        >
          <Input.Password
            value={argValues[key] ?? ""}
            onChange={(e) => updateArgValue(key, e.target.value)}
            placeholder={
              arg.example ? `e.g., ${arg.example}` : `Enter ${arg.name}`
            }
            status={
              arg.required && !(argValues[key] ?? "").trim() ? "error" : ""
            }
          />
        </Form.Item>
      );
    }

    // argument, argument_positional, volume.
    return (
      <Form.Item
        key={key}
        label={
          <Space>
            {arg.name}
            {arg.required && <Tag color="red">Required</Tag>}
            <Tag>{arg.type}</Tag>
          </Space>
        }
        help={arg.description}
      >
        <Input
          value={argValues[key] ?? ""}
          onChange={(e) => updateArgValue(key, e.target.value)}
          placeholder={
            arg.example ? `e.g., ${arg.example}` : `Enter value for ${arg.name}`
          }
          status={arg.required && !(argValues[key] ?? "").trim() ? "error" : ""}
        />
      </Form.Item>
    );
  };

  const renderServerListItem = (server: TaggedServer) => (
    <List.Item
      onClick={() => selectServer(server)}
      style={{
        cursor: "pointer",
        background:
          selectedServer?.id === server.id ? "#1890ff20" : "transparent",
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
              style={{ marginBottom: 8, fontSize: 13 }}
            >
              {server.description}
            </Paragraph>
            <Space wrap size="small">
              {server.tools.slice(0, 4).map((tool) => (
                <Tag key={tool.name} color="geekblue" style={{ fontSize: 11 }}>
                  {tool.name}
                </Tag>
              ))}
              {server.tools.length > 4 && (
                <Tag style={{ fontSize: 11 }}>
                  +{server.tools.length - 4} more
                </Tag>
              )}
              {Object.values(server.installations).map((inst) => (
                <Tag key={inst.runtime} color="green" style={{ fontSize: 11 }}>
                  {inst.runtime}
                </Tag>
              ))}
              {isValidLicense(server.license) && (
                <Tag color="purple" style={{ fontSize: 11 }}>
                  {server.license}
                </Tag>
              )}
              <Tag color="cyan" style={{ fontSize: 11 }}>
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
      <Space style={{ width: "100%", marginBottom: 8 }} direction="vertical">
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
          {searchQuery || activeFilterCount > 0 ? " matching" : " available"}
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
            <Collapse defaultActiveKey={Object.keys(serversByCategory)} ghost>
              {Object.entries(serversByCategory).map(([category, servers]) => (
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
              ))}
            </Collapse>
          )}
        </div>
      )}

      {selectedServer && (
        <Card title="Server Configuration" style={{ marginTop: 16 }}>
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="Server Name">
              <Input disabled />
            </Form.Item>

            <Form.Item name="package" label="Package">
              {Object.keys(selectedServer.installations).length > 1 ? (
                <Select
                  value={selectedRuntime}
                  onChange={(value) => {
                    setSelectedRuntime(value);
                    const inst = selectedServer.installations[value];
                    form.setFieldValue(
                      "package",
                      `${inst.runtime}::${inst.package}`,
                    );
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
                  <Divider orientation="left">Arguments</Divider>
                  {Object.entries(selectedServer.arguments).map(([key, arg]) =>
                    renderArgumentField(key, arg),
                  )}
                </>
              )}
          </Form>
        </Card>
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

      {tomlPreview && (
        <div style={{ marginTop: 16 }}>
          <Divider>Configuration Preview</Divider>
          <MonacoEditor
            height="150px"
            language="toml"
            theme="vs-dark"
            value={tomlPreview}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "off",
            }}
          />
        </div>
      )}
    </Modal>
  );
};

export default AddServerModal;
