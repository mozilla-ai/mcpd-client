#!/usr/bin/env node

// Simple test script to verify the bridge server can connect to MCPD
import axios from 'axios';

const MCPD_URL = process.env.MCPD_URL || 'http://localhost:8090';

async function testMCPDConnection() {
  console.log(`Testing connection to MCPD at ${MCPD_URL}...`);
  
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
    
    console.log('\n✅ MCPD connection test successful!');
    console.log('\nYou can now use the bridge server with:');
    console.log('  npx mcpd-bridge-server');
    
  } catch (error) {
    console.error('❌ Failed to connect to MCPD:', error.message);
    console.error('\nMake sure MCPD is running:');
    console.error('  1. Start the MCPD daemon through the Electron app');
    console.error('  2. Or run: mcpd start');
    process.exit(1);
  }
}

testMCPDConnection();