# MCPD Client

An Electron-based desktop application for managing MCP (Model Context Protocol) servers using Mozilla's mcpd daemon.

## Features

- **Visual Server Management**: Add, remove, and monitor MCP servers through an intuitive UI
- **Tool Explorer**: Browse and test MCP tools with live execution
- **Configuration Editor**: Edit `.mcpd.toml` files with syntax highlighting
- **Real-time Logs**: Monitor daemon and server logs with filtering and search
- **System Tray Integration**: Run in background with quick access controls
- **Dashboard**: Overview of system status, active servers, and available tools

## Prerequisites

- Node.js 16+ and npm
- mcpd installed (`brew install mozilla-ai/tap/mcpd` or from [GitHub releases](https://github.com/mozilla-ai/mcpd/releases))
- npx (for JavaScript MCP servers)
- uvx (for Python MCP servers)

## Installation

```bash
# Clone the repository
git clone https://github.com/alexmeckes/mcpd-client.git
cd mcpd-client

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run dist

# Platform-specific builds
npm run dist:mac    # macOS
npm run dist:win    # Windows
npm run dist:linux  # Linux
```

## Architecture

The application consists of:

- **Main Process**: Manages the mcpd daemon, handles IPC, and system tray
- **Renderer Process**: React-based UI with Ant Design components
- **mcpd Integration**: Communicates with mcpd's HTTP API on port 8090

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **TypeScript**: Type safety
- **Ant Design**: UI component library
- **Monaco Editor**: Code editing for configurations
- **xterm.js**: Terminal emulator for logs

## Usage

1. **Start the Daemon**: Click the power button in the header or use the system tray menu
2. **Add Servers**: Navigate to the Servers tab and click "Add Server"
3. **Explore Tools**: Use the Tools tab to browse and test available MCP tools
4. **Edit Configuration**: Modify `.mcpd.toml` directly in the Configuration tab
5. **Monitor Logs**: View real-time logs with filtering in the Logs tab

## License

ISC