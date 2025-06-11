// Simple test to verify wait command works
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testWaitCommand() {
  console.log('Testing wait command...');
  
  try {
    // Test help
    const helpResult = await execAsync('node ../bin/run.js wait --help');
    console.log('✅ Wait command help works');
    console.log(helpResult.stdout);
    
    // Test hover help
    const hoverHelp = await execAsync('node ../bin/run.js hover --help');
    console.log('\n✅ Hover command help works');
    console.log(hoverHelp.stdout);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWaitCommand();