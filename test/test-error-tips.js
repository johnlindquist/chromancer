const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testErrorTips() {
  console.log('Testing enhanced error messages...\n');
  
  const tests = [
    {
      name: 'Selector without prefix',
      command: 'click button',
      expectedTip: 'Did you forget to add a class (.) or ID (#) prefix?'
    },
    {
      name: 'Element not found',
      command: 'click #non-existent-button',
      expectedTip: 'Ensure the element exists'
    },
    {
      name: 'XPath selector',
      command: 'click "//button[@id=\'submit\']"',
      expectedTip: 'Use CSS selectors instead of XPath'
    },
    {
      name: 'Connection error (no Chrome)',
      command: 'navigate https://example.com --port 9999',
      expectedTip: 'Make sure Chrome is running'
    },
    {
      name: 'Invalid URL',
      command: 'navigate example.com',
      expectedTip: 'Make sure the URL includes the protocol'
    }
  ];
  
  for (const test of tests) {
    console.log(`\nTest: ${test.name}`);
    console.log(`Command: chromancer ${test.command}`);
    console.log('Expected to see tip about:', test.expectedTip);
    console.log('-'.repeat(60));
    
    try {
      await execAsync(`node ../bin/run.js ${test.command}`, {
        timeout: 5000
      });
    } catch (error) {
      // Extract just the error output
      const output = error.stderr || error.stdout || '';
      const lines = output.split('\n').filter(line => 
        line.includes('❌') || 
        line.includes('💡') || 
        line.includes('Example:') ||
        line.includes('📚')
      );
      
      console.log(lines.join('\n'));
    }
  }
}

// Run tests
if (require.main === module) {
  testErrorTips().catch(console.error);
}