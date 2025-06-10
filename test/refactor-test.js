// Test refactored commands work correctly
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testRefactoredCommands() {
  console.log('Testing refactored commands...\n');
  
  const tests = [
    {
      name: 'Click command help',
      cmd: 'node ./bin/run.js click --help',
      check: (output) => output.includes('Wait for selector') && output.includes('CSS selector')
    },
    {
      name: 'Hover command help',
      cmd: 'node ./bin/run.js hover --help',
      check: (output) => output.includes('Hover over an element') && output.includes('Duration')
    },
    {
      name: 'Wait command help',
      cmd: 'node ./bin/run.js wait --help',
      check: (output) => output.includes('Wait for elements') && output.includes('--selector')
    },
    {
      name: 'Store command help',
      cmd: 'node ./bin/run.js store --help',
      check: (output) => output.includes('Store values') && output.includes('--as')
    },
    {
      name: 'Assert command help',
      cmd: 'node ./bin/run.js assert --help',
      check: (output) => output.includes('Assert conditions') && output.includes('--equals')
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await execAsync(test.cmd);
      if (test.check(result.stdout)) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - Output validation failed`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Command failed: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

testRefactoredCommands();