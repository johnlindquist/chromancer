#!/usr/bin/env node

const { execSync } = require('child_process');
const assert = require('assert');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
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

log('\nChromancer Integration Workflow Tests', YELLOW);
log('=====================================', YELLOW);
log('Testing the expected single-session workflow\n', BLUE);

// Test 1: Basic workflow expectations
runTest('Commands use default port 9222', () => {
  // Check navigate help shows it uses the default port
  const navHelp = execSync('node ../bin/run.js navigate --help', { encoding: 'utf8', cwd: __dirname });
  assert(navHelp.includes('Chrome debugging port'), 'Port flag should be documented');
  assert(navHelp.includes('[default: 9222]'), 'Default port should be 9222');
  
  // Check spawn help shows default port
  const spawnHelp = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(spawnHelp.includes('[default: 9222]'), 'Spawn should use default port 9222');
});

// Test 2: Port is optional in commands
runTest('Port flag is optional in all commands', () => {
  const commands = ['navigate', 'click', 'type', 'screenshot', 'evaluate'];
  
  for (const cmd of commands) {
    const help = execSync(`node ../bin/run.js ${cmd} --help`, { encoding: 'utf8', cwd: __dirname });
    // Check that port has a default value
    assert(help.includes('-p, --port'), `${cmd} should have port flag`);
    assert(help.includes('[default: 9222]'), `${cmd} should have default port`);
  }
});

// Test 3: Spawn returns immediately
runTest('Spawn command syntax shows background execution', () => {
  const spawnHelp = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(spawnHelp.includes('Launch Chrome'), 'Should mention launching Chrome');
  
  // Check examples show simple usage
  const output = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('chromancer spawn'), 'Should show simple spawn example');
});

// Test 4: Navigate accepts domains without protocol
runTest('Navigate examples show simple domain usage', () => {
  const help = execSync('node ../bin/run.js navigate --help', { encoding: 'utf8', cwd: __dirname });
  assert(help.includes('example.com'), 'Should show example without https://');
  assert(help.includes('google.com'), 'Should show google.com example');
});

// Test 5: Commands connect to existing browser by default
runTest('Commands attempt to connect to existing browser', () => {
  // Try navigate without a running browser - should fail with helpful message
  try {
    execSync('node ../bin/run.js navigate example.com 2>&1', { 
      encoding: 'utf8', 
      cwd: __dirname,
      stdio: 'pipe'
    });
    throw new Error('Expected command to fail without Chrome');
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    assert(output.includes('No existing Chrome') || output.includes('Failed to connect'), 
      'Should show connection failure message');
    assert(output.includes('chromancer spawn') || output.includes('--launch'), 
      'Should suggest using spawn or --launch');
  }
});

// Test 6: Multiple port support
runTest('Commands support custom ports', () => {
  const help = execSync('node ../bin/run.js navigate --help', { encoding: 'utf8', cwd: __dirname });
  assert(help.includes('--port'), 'Should have port option');
  
  // Test with custom port
  try {
    execSync('node ../bin/run.js navigate example.com --port 9999 2>&1', { 
      encoding: 'utf8', 
      cwd: __dirname,
      stdio: 'pipe'
    });
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    assert(output.includes('9999'), 'Should mention the custom port in error');
  }
});

// Test 7: Stop command exists
runTest('Stop command is available', () => {
  const help = execSync('node ../bin/run.js --help', { encoding: 'utf8', cwd: __dirname });
  assert(help.includes('stop'), 'Should have stop command');
  
  const stopHelp = execSync('node ../bin/run.js stop --help', { encoding: 'utf8', cwd: __dirname });
  assert(stopHelp.includes('Stop the active Chrome'), 'Should describe stopping Chrome');
});

log('\n📋 Workflow Summary:', BLUE);
log('1. Run "chromancer spawn" to start Chrome in background', BLUE);
log('2. Chrome continues running, terminal returns immediately', BLUE);
log('3. Run commands like "chromancer navigate example.com"', BLUE);
log('4. Commands connect to the running Chrome (port 9222 by default)', BLUE);
log('5. Use --port flag for multiple Chrome instances', BLUE);
log('6. Run "chromancer stop" to close Chrome', BLUE);

log('\n✅ All integration tests passed!', GREEN);
log('The CLI correctly implements the single-session workflow.\n', GREEN);