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

log('URL Normalization Tests', YELLOW);
log('======================', YELLOW);

// Test 1: Help shows domain examples
runTest('Navigate help shows domain examples', () => {
  const output = execSync('node ../bin/run.js navigate --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('example.com'), 'example.com not found in help');
  assert(output.includes('google.com'), 'google.com not found in help');
});

// Test 2: Go command also shows domain example
runTest('Go help shows domain example', () => {
  const output = execSync('node ../bin/run.js go --help', { encoding: 'utf8', cwd: __dirname });
  assert(output.includes('example.com'), 'example.com not found in go help');
});

log('\nAll URL normalization tests passed! ✓', GREEN);