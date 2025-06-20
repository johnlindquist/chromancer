#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('Testing stdin fix for arrow navigation...\n');

// First build the project
console.log('Building project...');
try {
  execSync('pnpm run build', { 
    stdio: 'inherit',
    cwd: path.dirname(__dirname)
  });
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

console.log('\nBuild complete! Now test with:');
console.log('\n1. Start Chrome:');
console.log('   chromancer spawn --headless');
console.log('\n2. Run a simple command that will succeed:');
console.log('   chromancer ai "navigate to example.com" --debug');
console.log('\n3. When the success menu appears, check:');
console.log('   - Does the stdin test run?');
console.log('   - Can you use arrow keys?');
console.log('   - Does Enter work?');
console.log('\n4. Also test with a wait command:');
console.log('   chromancer ai "navigate to example.com, wait with message Press Enter to continue, take screenshot" --debug');
console.log('\nLook for these debug messages:');
console.log('- [DEBUG] stdin.readableFlowing is not true, forcing resume again');
console.log('- [DEBUG] Testing stdin responsiveness...');
console.log('- [DEBUG] stdin test received: ... (if you press a key)');