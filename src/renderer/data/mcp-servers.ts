export interface MCPServerTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  official?: boolean;
  package: {
    npx?: string;
    uvx?: string;
    docker?: string;
  };
  tools: {
    name: string;
    description: string;
  }[];
  environmentVariables?: {
    name: string;
    description: string;
    required: boolean;
    example?: string;
  }[];
  arguments?: {
    name: string;
    description: string;
    required: boolean;
    example?: string;
  }[];
  documentationUrl?: string;
}

export const MCP_SERVERS: MCPServerTemplate[] = [
  // File System & Storage
  {
    id: 'filesystem',
    name: 'FileSystem',
    category: 'File Management',
    description: 'Access and manipulate files and directories on the local filesystem',
    official: true,
    package: {
      npx: '@modelcontextprotocol/server-filesystem',
    },
    tools: [
      { name: 'read_file', description: 'Read contents of a file' },
      { name: 'write_file', description: 'Write content to a file' },
      { name: 'list_directory', description: 'List files in a directory' },
      { name: 'create_directory', description: 'Create a new directory' },
      { name: 'delete_file', description: 'Delete a file' },
      { name: 'move_file', description: 'Move or rename a file' },
      { name: 'search_files', description: 'Search for files by pattern' },
      { name: 'get_file_info', description: 'Get metadata about a file' },
    ],
    arguments: [
      {
        name: '--directory',
        description: 'Base directory for filesystem operations',
        required: true,
        example: '/tmp/workspace',
      },
    ],
  },
  {
    id: 'memory',
    name: 'Memory',
    category: 'Knowledge Management',
    description: 'Knowledge graph-based persistent memory for storing and retrieving information',
    official: true,
    package: {
      npx: '@modelcontextprotocol/server-memory',
    },
    tools: [
      { name: 'create_entities', description: 'Create new entities in the knowledge graph' },
      { name: 'create_relations', description: 'Create relationships between entities' },
      { name: 'search_entities', description: 'Search for entities' },
      { name: 'search_relations', description: 'Search for relationships' },
      { name: 'get_entity', description: 'Get details of a specific entity' },
      { name: 'get_relation', description: 'Get details of a specific relation' },
      { name: 'delete_entity', description: 'Delete an entity' },
      { name: 'delete_relation', description: 'Delete a relationship' },
      { name: 'open_nodes', description: 'Get nodes connected to an entity' },
    ],
  },

  // Development Tools
  {
    id: 'github',
    name: 'GitHub',
    category: 'Development',
    description: 'Interact with GitHub repositories, issues, pull requests, and more',
    official: true,
    package: {
      npx: '@modelcontextprotocol/server-github',
    },
    tools: [
      { name: 'create_repository', description: 'Create a new GitHub repository' },
      { name: 'list_repositories', description: 'List repositories for a user/org' },
      { name: 'create_issue', description: 'Create a new issue' },
      { name: 'list_issues', description: 'List issues in a repository' },
      { name: 'update_issue', description: 'Update an existing issue' },
      { name: 'add_issue_comment', description: 'Add a comment to an issue' },
      { name: 'create_pull_request', description: 'Create a new pull request' },
      { name: 'list_pull_requests', description: 'List pull requests' },
    ],
    environmentVariables: [
      {
        name: 'GITHUB_TOKEN',
        description: 'GitHub personal access token',
        required: true,
        example: 'ghp_...',
      },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'Development',
    description: 'Interact with GitLab projects, issues, and merge requests',
    package: {
      npx: '@modelcontextprotocol/server-gitlab',
    },
    tools: [
      { name: 'create_project', description: 'Create a new GitLab project' },
      { name: 'list_projects', description: 'List projects' },
      { name: 'create_issue', description: 'Create a new issue' },
      { name: 'create_merge_request', description: 'Create a merge request' },
    ],
    environmentVariables: [
      {
        name: 'GITLAB_TOKEN',
        description: 'GitLab personal access token',
        required: true,
      },
      {
        name: 'GITLAB_URL',
        description: 'GitLab instance URL',
        required: false,
        example: 'https://gitlab.com',
      },
    ],
  },

  // Communication
  {
    id: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: 'Send messages and interact with Slack workspaces',
    package: {
      npx: '@modelcontextprotocol/server-slack',
    },
    tools: [
      { name: 'send_message', description: 'Send a message to a channel' },
      { name: 'list_channels', description: 'List available channels' },
      { name: 'get_channel_history', description: 'Get message history from a channel' },
      { name: 'add_reaction', description: 'Add a reaction to a message' },
      { name: 'create_channel', description: 'Create a new channel' },
    ],
    environmentVariables: [
      {
        name: 'SLACK_BOT_TOKEN',
        description: 'Slack bot token',
        required: true,
        example: 'xoxb-...',
      },
      {
        name: 'SLACK_TEAM_ID',
        description: 'Slack workspace/team ID',
        required: true,
      },
    ],
  },

  // Databases
  {
    id: 'sqlite',
    name: 'SQLite',
    category: 'Database',
    description: 'Execute SQL queries and manage SQLite databases',
    official: true,
    package: {
      uvx: 'mcp-server-sqlite@latest',
    },
    tools: [
      { name: 'read_query', description: 'Execute a SELECT query' },
      { name: 'write_query', description: 'Execute INSERT/UPDATE/DELETE queries' },
      { name: 'create_table', description: 'Create a new table' },
      { name: 'list_tables', description: 'List all tables in the database' },
      { name: 'describe_table', description: 'Get table schema' },
      { name: 'append_insight', description: 'Add analytical insights' },
    ],
    arguments: [
      {
        name: '--db-path',
        description: 'Path to SQLite database file',
        required: true,
        example: './data.db',
      },
    ],
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'Database',
    description: 'Connect to and query PostgreSQL databases',
    package: {
      npx: '@modelcontextprotocol/server-postgres',
      uvx: 'mcp-server-postgres@latest',
    },
    tools: [
      { name: 'query', description: 'Execute SQL queries' },
      { name: 'list_tables', description: 'List database tables' },
      { name: 'describe_table', description: 'Get table structure' },
    ],
    environmentVariables: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL connection string',
        required: true,
        example: 'postgresql://user:pass@localhost:5432/dbname',
      },
    ],
  },

  // AI & Web
  {
    id: 'brave-search',
    name: 'Brave Search',
    category: 'Web & Search',
    description: 'Search the web using Brave Search API',
    package: {
      npx: '@modelcontextprotocol/server-brave-search',
    },
    tools: [
      { name: 'brave_web_search', description: 'Search the web with Brave' },
      { name: 'brave_local_search', description: 'Search for local businesses' },
    ],
    environmentVariables: [
      {
        name: 'BRAVE_API_KEY',
        description: 'Brave Search API key',
        required: true,
      },
    ],
  },
  {
    id: 'fetch',
    name: 'Web Fetch',
    category: 'Web & Search',
    description: 'Fetch and extract content from web pages',
    package: {
      npx: '@modelcontextprotocol/server-fetch',
    },
    tools: [
      { name: 'fetch', description: 'Fetch content from a URL' },
      { name: 'extract', description: 'Extract structured data from HTML' },
    ],
  },

  // Cloud Storage
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Cloud Storage',
    description: 'Access and manage files in Google Drive',
    package: {
      npx: '@modelcontextprotocol/server-google-drive',
    },
    tools: [
      { name: 'list_files', description: 'List files in Drive' },
      { name: 'read_file', description: 'Read file contents' },
      { name: 'create_file', description: 'Create a new file' },
      { name: 'update_file', description: 'Update file contents' },
      { name: 'move_file', description: 'Move file to different folder' },
      { name: 'search_files', description: 'Search for files' },
    ],
    environmentVariables: [
      {
        name: 'GOOGLE_DRIVE_CLIENT_ID',
        description: 'Google OAuth client ID',
        required: true,
      },
      {
        name: 'GOOGLE_DRIVE_CLIENT_SECRET',
        description: 'Google OAuth client secret',
        required: true,
      },
      {
        name: 'GOOGLE_DRIVE_REFRESH_TOKEN',
        description: 'Google OAuth refresh token',
        required: true,
      },
    ],
  },

  // Time & Utilities
  {
    id: 'time',
    name: 'Time',
    category: 'Utilities',
    description: 'Get current time and timezone information',
    package: {
      uvx: 'mcp-server-time@latest',
    },
    tools: [
      { name: 'get_current_time', description: 'Get the current time' },
      { name: 'convert_time', description: 'Convert time between timezones' },
    ],
    arguments: [
      {
        name: '--local-timezone',
        description: 'Set local timezone',
        required: false,
        example: 'America/New_York',
      },
    ],
  },

  // Note-taking
  {
    id: 'obsidian',
    name: 'Obsidian',
    category: 'Note-taking',
    description: 'Interact with Obsidian vaults and notes',
    package: {
      npx: '@modelcontextprotocol/server-obsidian',
    },
    tools: [
      { name: 'read_note', description: 'Read a note from vault' },
      { name: 'create_note', description: 'Create a new note' },
      { name: 'update_note', description: 'Update an existing note' },
      { name: 'list_notes', description: 'List notes in vault' },
      { name: 'search_notes', description: 'Search notes by content' },
    ],
    arguments: [
      {
        name: '--vault-path',
        description: 'Path to Obsidian vault',
        required: true,
        example: '~/Documents/ObsidianVault',
      },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Note-taking',
    description: 'Access and manage Notion pages and databases',
    package: {
      npx: '@modelcontextprotocol/server-notion',
    },
    tools: [
      { name: 'search_pages', description: 'Search Notion pages' },
      { name: 'read_page', description: 'Read page content' },
      { name: 'create_page', description: 'Create a new page' },
      { name: 'update_page', description: 'Update page content' },
      { name: 'query_database', description: 'Query a Notion database' },
    ],
    environmentVariables: [
      {
        name: 'NOTION_API_KEY',
        description: 'Notion integration token',
        required: true,
        example: 'secret_...',
      },
    ],
  },

  // Development Tools
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    category: 'Web Automation',
    description: 'Control headless Chrome for web scraping and automation',
    package: {
      npx: '@modelcontextprotocol/server-puppeteer',
    },
    tools: [
      { name: 'navigate', description: 'Navigate to a URL' },
      { name: 'screenshot', description: 'Take a screenshot' },
      { name: 'click', description: 'Click an element' },
      { name: 'type', description: 'Type text into an input' },
      { name: 'evaluate', description: 'Execute JavaScript in page' },
    ],
  },
];

// Helper function to get servers by category
export function getServersByCategory(): Record<string, MCPServerTemplate[]> {
  const categories: Record<string, MCPServerTemplate[]> = {};
  
  MCP_SERVERS.forEach(server => {
    if (!categories[server.category]) {
      categories[server.category] = [];
    }
    categories[server.category].push(server);
  });
  
  return categories;
}

// Helper function to search servers
export function searchServers(query: string): MCPServerTemplate[] {
  const lowerQuery = query.toLowerCase();
  return MCP_SERVERS.filter(server => 
    server.name.toLowerCase().includes(lowerQuery) ||
    server.description.toLowerCase().includes(lowerQuery) ||
    server.category.toLowerCase().includes(lowerQuery) ||
    server.tools.some(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    )
  );
}