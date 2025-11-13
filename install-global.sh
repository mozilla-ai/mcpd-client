#!/bin/bash

# mcpd Client Global Install Script
# This installs the mcpd-setup tool globally so you can use it from anywhere

echo "🚀 Installing mcpd Setup Tools..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Install mcpd-setup globally
echo -e "${BLUE}Installing mcpd-setup CLI tool...${NC}"
cd "$SCRIPT_DIR/mcpd-setup"
npm install
npm run build
npm link

# Install mcpd-bridge-server globally
echo -e "${BLUE}Installing mcpd-bridge-server...${NC}"
cd "$SCRIPT_DIR/mcpd-bridge-server"
npm install
npm run build

# Install mcpd-http-gateway globally
echo -e "${BLUE}Installing mcpd-http-gateway...${NC}"
cd "$SCRIPT_DIR/mcpd-http-gateway"
npm install
npm run build

echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "You can now use these commands from anywhere:"
echo "  mcpd-setup                    - Setup tool for connecting MCP servers"
echo "  mcpd-setup list               - List available servers"
echo "  mcpd-setup [server] --client claude  - Setup for Claude Desktop"
echo "  mcpd-setup [server] --client http    - Start HTTP gateway"
echo ""
echo "Example:"
echo "  mcpd-setup filesystem --client claude"