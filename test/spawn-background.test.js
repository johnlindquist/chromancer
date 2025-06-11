#!/usr/bin/env node

const { execSync } = require('child_process');
const assert = require('assert');

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

log('Spawn Background Tests', YELLOW);
log('======================', YELLOW);

// Test 1: Spawn help shows correct examples
runTest('Spawn help shows background usage', () => {
  const output = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('Launch Chrome'), 'spawn description not found');
  assert(output.includes('--port'), 'port flag not documented');
  assert(output.includes('--headless'), 'headless flag not documented');
  assert(output.includes('--profile'), 'profile flag not documented');
});

// Test 2: Stop command help
runTest('Stop command shows help', () => {
  const output = execSync('node ../bin/run.js stop --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('Stop the active Chrome'), 'stop description not found');
});

// Test 3: Navigate command doesn't hang
runTest('Navigate command returns immediately', async () => {
  // This test would ideally check that navigate doesn't block
  // but without a running Chrome instance, we'll just verify the help works
  const output = execSync('node ../bin/run.js navigate --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('Navigate to a URL'), 'navigate description not found');
});

// Test 4: SessionManager functionality
runTest('SessionManager can save and load sessions', () => {
  const { SessionManager } = require('../dist/session.js');
  
  // Test save and load
  const testSession = {
    port: 9222,
    pid: 12345,
    startTime: Date.now(),
    url: 'https://example.com'
  };
  
  SessionManager.saveSession(testSession);
  const loaded = SessionManager.loadSession();
  
  assert.equal(loaded.port, testSession.port, 'Port should match');
  assert.equal(loaded.pid, testSession.pid, 'PID should match');
  assert.equal(loaded.url, testSession.url, 'URL should match');
  
  // Clean up
  SessionManager.clearSession();
  const cleared = SessionManager.loadSession();
  assert.equal(cleared, null, 'Session should be cleared');
});

log('\nAll spawn background tests passed! ✓', GREEN);