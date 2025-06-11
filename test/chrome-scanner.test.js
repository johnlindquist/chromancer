#!/usr/bin/env node

const { execSync } = require('child_process');
const assert = require('assert');
const net = require('net');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function runTest(name, fn) {
  try {
    fn();
    log(`✓ ${name}`, GREEN);
  } catch (error) {
    log(`✗ ${name}`, RED);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

// Start a dummy server to simulate Chrome on a port
function createDummyServer(port) {
  const server = net.createServer();
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => resolve(server));
  });
}

log('Chrome Scanner Tests', YELLOW);
log('====================', YELLOW);

// Test 1: Chrome scanner module exists
runTest('Chrome scanner utilities are available', () => {
  const scannerPath = '../dist/utils/chrome-scanner.js';
  try {
    require(scannerPath);
  } catch (error) {
    throw new Error(`Chrome scanner not found at ${scannerPath}. Run 'npm run build' first.`);
  }
});

// Test 2: Spawn command has profile options
runTest('Spawn command has --no-profile flag', () => {
  const help = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(help.includes('--no-profile'), '--no-profile flag not found');
  assert(help.includes('Launch Chrome without any profile'), 'no-profile description not found');
});

// Test 3: Spawn command has wait-for-ready option
runTest('Spawn command has --wait-for-ready flag', () => {
  const help = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(help.includes('--wait-for-ready'), '--wait-for-ready flag not found');
  assert(help.includes('Wait for Chrome to be fully ready'), 'wait-for-ready description not found');
});

// Test 4: Spawn examples show profile options
runTest('Spawn examples include profile scenarios', () => {
  const help = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(help.includes('--no-profile'), 'Should show --no-profile example');
  assert(help.includes('Skip profile picker'), 'Should explain no-profile usage');
  assert(help.includes('--profile'), 'Should show --profile example');
});

// Test 5: Navigate command handles connection failures gracefully
runTest('Navigate shows helpful error when Chrome not found', () => {
  try {
    // Try to navigate without Chrome running
    execSync('node ../bin/run.js navigate example.com --port 9999 2>&1', { 
      encoding: 'utf8', 
      cwd: __dirname,
      stdio: 'pipe'
    });
    throw new Error('Expected command to fail');
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    // Should mention scanning for instances
    assert(output.includes('Scanning') || output.includes('No existing Chrome'), 
      'Should show scanning message');
    // Should suggest spawn with profile options
    assert(output.includes('spawn') || output.includes('--launch'), 
      'Should suggest spawn command');
  }
});

// Test 6: Scanner functionality (unit test)
runTest('Chrome scanner can check port availability', async () => {
  const { checkPortAvailable } = require('../dist/utils/chrome-scanner.js');
  
  // Test with a likely available port
  const isAvailable = await checkPortAvailable(19999);
  assert(typeof isAvailable === 'boolean', 'Should return a boolean');
  
  // Test with a port we'll occupy
  const server = await createDummyServer(19998);
  const isOccupied = await checkPortAvailable(19998);
  assert(isOccupied === false, 'Should detect occupied port');
  server.close();
});

// Test 7: Base command shows improved error messages
runTest('Base command error mentions profile options', () => {
  try {
    execSync('node ../bin/run.js click button 2>&1', { 
      encoding: 'utf8', 
      cwd: __dirname,
      stdio: 'pipe'
    });
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    assert(output.includes('spawn --no-profile') || output.includes('Possible solutions'), 
      'Error should mention profile options');
  }
});

log('\nAll Chrome scanner tests passed! ✓', GREEN);
log('Profile picker scenarios are now handled properly.\n', GREEN);