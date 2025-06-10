const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Chromancer Vitest Tests...\n');

// Start Chrome first using the chromancer spawn command
console.log('Starting Chrome with remote debugging...');
const chromancerPath = path.join(__dirname, '..', 'bin', 'run.js');
const chromeProcess = spawn('node', [chromancerPath, 'spawn', '--headless'], {
  stdio: 'inherit'
});

// Wait for Chrome to start
setTimeout(() => {
  console.log('\nRunning tests...\n');
  
  // Run vitest
  const testProcess = spawn('npx', ['vitest', 'run'], {
    stdio: 'inherit',
    shell: true
  });
  
  testProcess.on('close', (code) => {
    console.log('\nTests completed. Stopping Chrome...');
    chromeProcess.kill();
    process.exit(code);
  });
}, 3000);

// Handle interrupts
process.on('SIGINT', () => {
  console.log('\nInterrupted. Stopping Chrome...');
  chromeProcess.kill();
  process.exit(1);
});