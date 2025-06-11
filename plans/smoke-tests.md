# Chromancer Smoke Test Plan

## Overview
This document outlines the smoke tests to perform once the devcontainer is restarted with Chrome installed. These tests will help us identify and fix the critical bugs reported.

## Prerequisites
- Devcontainer restarted with Chrome installed
- Project built with `npm run build`
- Chrome available at `/usr/bin/google-chrome-stable`

## Critical Issues to Test

### 1. Navigate Command Hanging
**Issue**: After navigation completes, the process hangs instead of exiting.

**Test Steps**:
```bash
# Start Chrome
./bin/run.js spawn

# In another terminal or after spawn completes
./bin/run.js navigate google.com

# Expected: Command should complete and return to prompt
# Actual: Process hangs, requires Ctrl+C
```

**Debug Steps**:
1. Add console.log in base.ts `finally()` to confirm it's called
2. Check if event listeners are keeping process alive
3. Test with `--verbose` flag to see detailed logs
4. Try with `--no-keepOpen` flag

### 2. REPL Auto-Exiting
**Issue**: REPL/interactive mode exits immediately instead of staying open.

**Test Steps**:
```bash
# Start Chrome first
./bin/run.js spawn

# Try to start REPL
./bin/run.js repl
# OR
./bin/run.js interactive

# Expected: Should show prompt and wait for input
# Actual: Shows message and immediately exits
```

**Debug Steps**:
1. Check if stdin is in TTY mode
2. Verify readline interface setup
3. Test with explicit stdin.setRawMode(true)
4. Check if process.stdin.isTTY is true

### 3. Profile Picker Breaking Connection
**Issue**: When Chrome shows profile picker, debugger cannot connect.

**Test Steps**:
```bash
# Test default behavior (should use temp profile)
./bin/run.js spawn
./bin/run.js navigate google.com  # Should work

# Test with explicit profile
./bin/run.js spawn --profile test
./bin/run.js navigate google.com  # Should work

# Test with default profile (will show picker)
./bin/run.js spawn --use-default-profile
# Chrome opens with profile picker
./bin/run.js navigate google.com  # Will fail to connect
```

## Additional Smoke Tests

### 4. Basic Command Flow
```bash
# Full workflow test
./bin/run.js spawn
./bin/run.js navigate example.com
./bin/run.js screenshot test.png
./bin/run.js click "a"
./bin/run.js type "input" "hello world"
./bin/run.js stop
```

### 5. Port Scanning
```bash
# Start Chrome on different port
./bin/run.js spawn --port 9223

# Try default port (should fail and scan)
./bin/run.js navigate example.com
# Should find Chrome on 9223 and connect
```

### 6. Launch Flag
```bash
# Without existing Chrome
./bin/run.js navigate example.com --launch
# Should launch Chrome and navigate
```

## Test Utilities

### Process Hanging Test
Create `/workspace/test-process-hang.js`:
```javascript
const { chromium } = require('playwright');

async function test() {
  console.log('Connecting...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  console.log('Connected');
  
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  
  await page.goto('https://google.com');
  console.log('Navigated - process should exit now');
  
  // Test different cleanup approaches:
  // 1. Do nothing (current behavior - hangs)
  // 2. browser.close() - closes Chrome
  // 3. process.exit(0) - forces exit
  // 4. browser._channel?.close() - might disconnect?
}

test();

setTimeout(() => {
  console.error('ERROR: Still running after 5 seconds!');
  process.exit(1);
}, 5000);
```

### REPL Test
Create `/workspace/test-repl-hang.js`:
```javascript
const readline = require('readline');

console.log('Testing readline...');
console.log('process.stdin.isTTY:', process.stdin.isTTY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'test> ',
  terminal: true
});

process.stdin.resume();

rl.prompt();

rl.on('line', (input) => {
  console.log('Got input:', input);
  if (input === 'exit') {
    rl.close();
  } else {
    rl.prompt();
  }
});

rl.on('close', () => {
  console.log('Closing...');
  process.exit(0);
});

// Safety timeout
setTimeout(() => {
  console.error('ERROR: REPL test timed out');
  process.exit(1);
}, 30000);
```

## Expected Fixes

### 1. Navigate Hanging Fix
- Properly disconnect from browser without closing it
- Ensure all event listeners are cleaned up
- May need to call `process.exit(0)` after successful navigation

### 2. REPL Fix
- Ensure stdin stays in raw mode
- Prevent `finally()` from being called
- Keep browser connection alive during interactive session

### 3. Profile Fix
- Already implemented: default to temp profile
- Document that profile picker breaks debugging (Chrome limitation)

## Success Criteria
- [ ] Navigate command exits cleanly after completion
- [ ] REPL stays open and accepts commands
- [ ] Default spawn avoids profile picker
- [ ] All commands work in sequence without hanging
- [ ] Tests pass without warnings or errors

## Next Steps
1. Run each smoke test after container restart
2. Identify root causes of failures
3. Implement fixes
4. Add automated tests to prevent regression
5. Update documentation with any limitations