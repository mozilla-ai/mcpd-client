#!/usr/bin/env node

// Simple test script to verify the bridge server can connect to mcpd
import axios from 'axios';

const MCPD_URL = process.env.MCPD_URL || 'http://localhost:8090';

async function testMcpdConnection() {
  console.log(`Testing connection to mcpd at ${MCPD_URL}...`);
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${MCPD_URL}/api/v1/health`);
    console.log('✓ Health check passed:', healthResponse.data);
    
    // List servers
    const serversResponse = await axios.get(`${MCPD_URL}/api/v1/servers`);
    const servers = serversResponse.data.servers || [];
    console.log(`✓ Found ${servers.length} servers:`, servers.map(s => s.name));
    
    // List tools for each server
    for (const server of servers) {
      try {
        const toolsResponse = await axios.get(`${MCPD_URL}/api/v1/servers/${server.name}/tools`);
        const tools = toolsResponse.data.tools || [];
        console.log(`  - ${server.name}: ${tools.length} tools`);
        if (tools.length > 0) {
          console.log(`    Tools: ${tools.slice(0, 3).map(t => t.name).join(', ')}${tools.length > 3 ? '...' : ''}`);
        }
      } catch (error) {
        console.log(`  - ${server.name}: Failed to fetch tools`);
      }
    }
    
    console.log('\n✅ mcpd connection test successful!');
    console.log('\nYou can now use the bridge server with:');
    console.log('  npx mcpd-bridge-server');
    
  } catch (error) {
    console.error('❌ Failed to connect to mcpd:', error.message);
    console.error('\nMake sure mcpd is running:');
    console.error('  1. Start the mcpd daemon through the Electron app');
    console.error('  2. Or run: mcpd daemon');
    process.exit(1);
  }
}

testMcpdConnection();