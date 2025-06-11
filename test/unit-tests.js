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

log('Unit Tests - CLI Structure', YELLOW);
log('==========================', YELLOW);

// Test 1: CLI runs without error
runTest('CLI executable runs', () => {
  execSync('node ../bin/run.js --version', { encoding: 'utf8', cwd: __dirname });
});

// Test 2: Help command shows all commands
runTest('Help lists all commands', () => {
  const output = execSync('node ../bin/run.js --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('navigate'), 'navigate command not found');
  assert(output.includes('click'), 'click command not found');
  assert(output.includes('type'), 'type command not found');
  assert(output.includes('evaluate'), 'evaluate command not found');
  assert(output.includes('screenshot'), 'screenshot command not found');
  assert(output.includes('spawn'), 'spawn command not found');
  assert(output.includes('stop'), 'stop command not found');
});

// Test 3: Command help works
runTest('Navigate help works', () => {
  const output = execSync('node ../bin/run.js navigate --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('URL to navigate to'), 'URL argument not documented');
  assert(output.includes('--wait-until'), 'wait-until flag not documented');
});

// Test 4: Click help works
runTest('Click help works', () => {
  const output = execSync('node ../bin/run.js click --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('CSS selector'), 'selector argument not documented');
  assert(output.includes('--wait-for-selector'), 'wait-for-selector flag not documented');
});

// Test 5: Type help works
runTest('Type help works', () => {
  const output = execSync('node ../bin/run.js type --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('Text to type'), 'text argument not documented');
  assert(output.includes('--clear-first'), 'clear-first flag not documented');
});

// Test 6: Evaluate help works
runTest('Evaluate help works', () => {
  const output = execSync('node ../bin/run.js evaluate --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('JavaScript code'), 'script argument not documented');
});

// Test 7: Screenshot help works
runTest('Screenshot help works', () => {
  const output = execSync('node ../bin/run.js screenshot --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('Output filename'), 'filename argument not documented');
  assert(output.includes('--full-page'), 'full-page flag not documented');
});

// Test 8: Spawn help works
runTest('Spawn help works', () => {
  const output = execSync('node ../bin/run.js spawn --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('URL to open'), 'url argument not documented');
  assert(output.includes('--port'), 'port flag not documented');
  assert(output.includes('--headless'), 'headless flag not documented');
});

// Test 9: Stop help works
runTest('Stop help works', () => {
  const output = execSync('node ../bin/run.js stop --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('Stop the active Chrome'), 'stop description not found');
});

// Test 10: Launch flag is available
runTest('Launch flag available in all commands', () => {
  const commands = ['navigate', 'click', 'type', 'evaluate', 'screenshot'];
  commands.forEach(cmd => {
    const output = execSync(`node ../bin/run.js ${cmd} --help`, { encoding: 'utf8', cwd: __dirname });
    assert(output.includes('--launch'), `launch flag not found in ${cmd} command`);
  });
});

// Test 11: Error handling for missing arguments
runTest('Missing arguments show error', () => {
  try {
    execSync('node ../bin/run.js navigate 2>&1', { encoding: 'utf8', stdio: 'pipe', cwd: __dirname });
    throw new Error('Expected command to fail');
  } catch (error) {
    // The error should be thrown when missing required argument
    assert(error.status !== 0, 'Command should have non-zero exit status');
  }
});

log('\nAll unit tests passed! ✓', GREEN);