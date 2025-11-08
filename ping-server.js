#!/usr/bin/env node

/**
 * Ping Server Test Utility
 * 
 * Tests the /ping endpoint to verify it's working correctly.
 * Simulates what UptimeRobot does when monitoring your server.
 * 
 * Usage:
 *   node ping-server.js                           # Ping localhost:5000
 *   node ping-server.js https://your-render-url   # Ping production
 * 
 * Examples:
 *   node ping-server.js
 *   node ping-server.js https://ratesangeet.onrender.com
 */

const https = require('https');
const http = require('http');

// Get target URL from command line or use default
const targetUrl = process.argv[2] || 'http://localhost:5000/ping';

const parsedUrl = new URL(targetUrl);
const client = parsedUrl.protocol === 'https:' ? https : http;

console.log(`\n🏓 Pinging: ${targetUrl}\n`);

const startTime = Date.now();

const req = client.get(targetUrl, (res) => {
  const responseTime = Date.now() - startTime;
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:');
    console.log(`  Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`  Time: ${responseTime}ms`);
    console.log(`  Body: "${data}"`);
    
    if (res.statusCode === 200 && data.trim() === 'pong') {
      console.log('\n✅ Ping successful! Server is responding correctly.\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  Unexpected response. Check server logs.\n');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error(`\n❌ Ping failed: ${error.message}\n`);
  console.log('Make sure the server is running:');
  console.log('  cd server && npm run dev\n');
  process.exit(1);
});

req.setTimeout(10000, () => {
  console.error('\n❌ Ping timeout (10s). Server may be cold starting or down.\n');
  req.destroy();
  process.exit(1);
});
