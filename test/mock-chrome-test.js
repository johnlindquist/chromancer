#!/usr/bin/env node

const http = require('http');
const { execSync } = require('child_process');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

// Create a mock Chrome DevTools server
function createMockServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/json/version') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        "Browser": "Mock Chrome",
        "Protocol-Version": "1.3",
        "User-Agent": "Mock",
        "V8-Version": "9.0",
        "WebKit-Version": "537.36",
        "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/mock"
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  return server;
}

log('Mock Chrome Test', YELLOW);
log('================', YELLOW);

const server = createMockServer();

server.listen(9222, 'localhost', () => {
  log('Mock Chrome server started on port 9222', GREEN);
  
  // Test that we can detect the mock server
  try {
    const output = execSync('curl -s http://localhost:9222/json/version', { encoding: 'utf8' });
    const version = JSON.parse(output);
    log(`Mock server responding: ${version.Browser}`, GREEN);
  } catch (error) {
    log('Failed to connect to mock server', RED);
    server.close();
    process.exit(1);
  }

  log('\nNote: This is a basic connectivity test only.', YELLOW);
  log('The mock server does not implement full Chrome DevTools Protocol.', YELLOW);
  log('For full testing, please use a real Chrome instance.', YELLOW);
  
  // Close the server after tests
  setTimeout(() => {
    server.close();
    log('\nMock server stopped', GREEN);
  }, 2000);
});