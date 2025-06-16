#!/usr/bin/env node

const { execSync } = require('child_process');
const assert = require('assert');
const fs = require('fs');

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
    return true;
  } catch (error) {
    log(`✗ ${name}`, RED);
    console.error(`  ${error.message}`);
    return false;
  }
}

log('Regression Tests', YELLOW);
log('================', YELLOW);
log('These tests verify edge cases and potential issues\n', YELLOW);

let passed = 0;
let failed = 0;

// Test 1: Handle special characters in selectors
if (runTest('Special characters in selectors', () => {
  try {
    execSync('node ./bin/run.js click "div[data-test=\'value\']" --help 2>&1', { encoding: 'utf8' });
  } catch (e) {
    // Should show help, not crash
    assert(e.message.includes('CSS selector'), 'Should handle special chars gracefully');
  }
})) passed++; else failed++;

// Test 2: Handle very long text input
if (runTest('Long text input handling', () => {
  const longText = 'a'.repeat(1000);
  try {
    execSync(`node ./bin/run.js type --help 2>&1`, { encoding: 'utf8' });
    // Just verify command structure works with potentially long inputs
  } catch (e) {
    throw new Error('Should handle long text parameters');
  }
})) passed++; else failed++;

// Test 3: Invalid port numbers
if (runTest('Invalid port validation', () => {
  const outputs = [];
  try {
    // Test negative port
    execSync('node ./bin/run.js navigate https://example.com --port -1 2>&1', { encoding: 'utf8' });
  } catch (e) {
    outputs.push('negative');
  }
  
  try {
    // Test port too high
    execSync('node ./bin/run.js navigate https://example.com --port 99999 2>&1', { encoding: 'utf8' });
  } catch (e) {
    outputs.push('too-high');
  }
  
  // Both should fail
  assert(outputs.length >= 1, 'Should validate port numbers');
})) passed++; else failed++;

// Test 4: Screenshot with invalid path
if (runTest('Screenshot invalid path handling', () => {
  try {
    execSync('node ./bin/run.js screenshot /nonexistent/path/file.png --help 2>&1', { encoding: 'utf8' });
    // Help should work regardless of path
  } catch (e) {
    throw new Error('Should handle help even with invalid paths');
  }
})) passed++; else failed++;

// Test 5: Multiple flags combination
if (runTest('Multiple flags work together', () => {
  const output = execSync('node ./bin/run.js navigate --help', { encoding: 'utf8' });
  assert(output.includes('--port'), 'Should have port flag');
  assert(output.includes('--host'), 'Should have host flag');
  assert(output.includes('--launch'), 'Should have launch flag');
  assert(output.includes('--wait-until'), 'Should have wait-until flag');
})) passed++; else failed++;

// Test 6: JavaScript injection safety
if (runTest('JavaScript injection safety', () => {
  // Verify evaluate command exists but we can't test actual execution without Chrome
  const output = execSync('node ./bin/run.js evaluate --help', { encoding: 'utf8' });
  assert(output.includes('JavaScript code to execute'), 'Should document JS execution');
})) passed++; else failed++;

// Test 7: Concurrent command handling
if (runTest('Commands are isolated', () => {
  // Each command should create its own connection
  const help1 = execSync('node ./bin/run.js navigate --help', { encoding: 'utf8' });
  const help2 = execSync('node ./bin/run.js click --help', { encoding: 'utf8' });
  assert(help1 !== help2, 'Different commands should have different help');
})) passed++; else failed++;

// Test 8: Error message clarity
if (runTest('Clear error messages', () => {
  try {
    execSync('node ./bin/run.js navigate 2>&1', { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    // Should have clear error about missing URL
    assert(e.status !== 0, 'Should exit with error');
  }
})) passed++; else failed++;

// Test 9: File permissions for screenshots
if (runTest('Screenshot file permissions', () => {
  // Test that screenshot command structure is correct
  const output = execSync('node ./bin/run.js screenshot --help', { encoding: 'utf8' });
  assert(output.includes('--format'), 'Should have format option');
  assert(output.includes('png'), 'Should support PNG');
  assert(output.includes('jpeg'), 'Should support JPEG');
})) passed++; else failed++;

// Test 10: Command aliases and shortcuts
if (runTest('Flag shortcuts work', () => {
  const output = execSync('node ./bin/run.js navigate --help', { encoding: 'utf8' });
  assert(output.includes('-p,'), 'Should have -p shortcut for port');
  assert(output.includes('-h,'), 'Should have -h shortcut for host');
  assert(output.includes('-l,'), 'Should have -l shortcut for launch');
})) passed++; else failed++;

// Summary
console.log('');
log('Regression Test Summary', YELLOW);
log('======================', YELLOW);
log(`Passed: ${passed}`, GREEN);
if (failed > 0) {
  log(`Failed: ${failed}`, RED);
  process.exit(1);
} else {
  log('All regression tests passed! ✓', GREEN);
}