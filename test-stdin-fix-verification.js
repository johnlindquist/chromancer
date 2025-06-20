#!/usr/bin/env node

const { spawn } = require('child_process');
const { EOL } = require('os');

console.log('Testing stdin fix for AI command arrow key navigation...\n');

// Test with debug flag to see terminal state
const child = spawn('node', ['./bin/run.js', 'ai', '--debug', 'Take a screenshot'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

let stage = 'initial';
let verificationSent = false;

// Simulate workflow execution stages
setTimeout(() => {
  console.log('\n[TEST] Simulating initial workflow failure...');
  stage = 'verification';
}, 3000);

// When we see verification complete, send arrow key sequences
child.stdout?.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('AI Verification complete') && !verificationSent) {
    verificationSent = true;
    console.log('\n[TEST] Verification complete detected. Testing arrow keys...');
    
    // Wait a bit for the menu to appear
    setTimeout(() => {
      console.log('[TEST] Sending DOWN arrow key sequence: 0x1b 0x5b 0x42');
      child.stdin.write(Buffer.from([0x1b, 0x5b, 0x42])); // Down arrow
      
      setTimeout(() => {
        console.log('[TEST] Sending UP arrow key sequence: 0x1b 0x5b 0x41');
        child.stdin.write(Buffer.from([0x1b, 0x5b, 0x41])); // Up arrow
        
        setTimeout(() => {
          console.log('[TEST] Sending ENTER key: 0x0d');
          child.stdin.write(Buffer.from([0x0d])); // Enter
          
          // Exit after a moment
          setTimeout(() => {
            console.log('\n[TEST] Test complete. Check if arrow keys worked in the menu.');
            process.exit(0);
          }, 2000);
        }, 1000);
      }, 1000);
    }, 2000);
  }
});

child.on('exit', (code) => {
  console.log(`\n[TEST] Process exited with code ${code}`);
});

// Safety timeout
setTimeout(() => {
  console.log('\n[TEST] Test timeout reached. Terminating...');
  child.kill();
  process.exit(1);
}, 30000);