#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PORT = 9222;
const TEST_URL = 'https://example.com';

// Color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passedTests = 0;
let failedTests = 0;

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function runCommand(command, expectError = false) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    if (expectError) {
      throw new Error(`Expected command to fail but it succeeded: ${command}`);
    }
    return output;
  } catch (error) {
    if (!expectError) {
      throw error;
    }
    return error.message;
  }
}

function runTest(testName, testFn) {
  process.stdout.write(`Testing ${testName}... `);
  try {
    testFn();
    log('PASSED', GREEN);
    passedTests++;
  } catch (error) {
    log('FAILED', RED);
    log(`  Error: ${error.message}`, RED);
    failedTests++;
  }
}

function checkChromeConnection() {
  try {
    // Try to connect to Chrome DevTools
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${CHROME_PORT}/json/version`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch {
    return Promise.resolve(false);
  }
}

async function main() {
  log('Chrome DevTools Protocol CLI Test Suite', YELLOW);
  log('=====================================', YELLOW);
  console.log('');

  // Check if Chrome is running
  const chromeConnected = await checkChromeConnection();
  if (!chromeConnected) {
    log(`Chrome is not running on port ${CHROME_PORT}`, RED);
    log('Please start Chrome with:', YELLOW);
    log(`  chromancer spawn --headless --port ${CHROME_PORT}`, YELLOW);
    log('Or for testing with GUI:', YELLOW);
    log(`  chromancer spawn --port ${CHROME_PORT}`, YELLOW);
    process.exit(1);
  }

  log('Chrome connection verified ✓', GREEN);
  console.log('');

  // Test 1: Help command
  runTest('help command', () => {
    const output = runCommand('node ./bin/run.js --help');
    if (!output.includes('VERSION') || !output.includes('COMMANDS')) {
      throw new Error('Help output missing expected content');
    }
  });

  // Test 2: Navigate command
  runTest('navigate command', () => {
    const output = runCommand(`node ./bin/run.js navigate ${TEST_URL}`);
    if (!output.includes('Successfully navigated')) {
      throw new Error('Navigation did not complete successfully');
    }
  });

  // Test 3: Screenshot command
  runTest('screenshot command', () => {
    const screenshotPath = 'test-screenshot.png';
    runCommand(`node ./bin/run.js screenshot ${screenshotPath}`);
    if (!fs.existsSync(screenshotPath)) {
      throw new Error('Screenshot file was not created');
    }
    // Clean up
    fs.unlinkSync(screenshotPath);
  });

  // Test 4: Evaluate command - get title
  runTest('evaluate command (get title)', () => {
    const output = runCommand('node ./bin/run.js evaluate "document.title"');
    if (!output.includes('Example Domain')) {
      throw new Error('Did not get expected page title');
    }
  });

  // Test 5: Evaluate command - count elements
  runTest('evaluate command (count links)', () => {
    const output = runCommand('node ./bin/run.js evaluate "document.querySelectorAll(\'a\').length"');
    if (!output.includes('Result:')) {
      throw new Error('Evaluate command did not return a result');
    }
  });

  // Test 6: Invalid selector (should fail gracefully)
  runTest('click command with invalid selector', () => {
    runCommand('node ./bin/run.js click ".non-existent-element" --timeout 1000', true);
  });

  // Test 7: Type command with non-existent input
  runTest('type command with invalid selector', () => {
    runCommand('node ./bin/run.js type "input.non-existent" "test" --timeout 1000', true);
  });

  // Test 8: Navigate to invalid URL
  runTest('navigate to invalid URL', () => {
    runCommand('node ./bin/run.js navigate "not-a-valid-url"', true);
  });

  // Test 9: Full page screenshot
  runTest('full page screenshot', () => {
    const screenshotPath = 'test-fullpage.png';
    runCommand(`node ./bin/run.js screenshot ${screenshotPath} --full-page`);
    if (!fs.existsSync(screenshotPath)) {
      throw new Error('Full page screenshot file was not created');
    }
    // Clean up
    fs.unlinkSync(screenshotPath);
  });

  // Test 10: Multiple commands in sequence
  runTest('command sequence', () => {
    runCommand(`node ./bin/run.js navigate ${TEST_URL}`);
    const output = runCommand('node ./bin/run.js evaluate "window.location.href"');
    if (!output.includes('example.com')) {
      throw new Error('Sequential commands did not maintain state');
    }
  });

  // Summary
  console.log('');
  log('Test Summary', YELLOW);
  log('============', YELLOW);
  log(`Passed: ${passedTests}`, GREEN);
  if (failedTests > 0) {
    log(`Failed: ${failedTests}`, RED);
    process.exit(1);
  } else {
    log('All tests passed! ✓', GREEN);
  }
}

main().catch(console.error);