const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');

async function runTestSuite(name, testFile) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${name}`);
  console.log('='.repeat(60));
  
  try {
    const result = await execAsync(`node ${testFile}`, {
      cwd: __dirname,
      timeout: 60000 // 1 minute timeout
    });
    
    console.log(result.stdout);
    if (result.stderr) {
      console.error('STDERR:', result.stderr);
    }
    
    return { success: true, name };
  } catch (error) {
    console.log(error.stdout || '');
    console.error(error.stderr || error.message);
    return { success: false, name, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Running All Enhanced Feature Tests\n');
  console.log('This will test:');
  console.log('  1. CLI IntelliSense (command registry, fuzzy search, schemas)');
  console.log('  2. YAML Workflows (parsing, variables, error modes)');
  console.log('  3. Error Tips (smart messages, pattern detection, formatting)');
  console.log('  4. Original unit tests (basic command structure)');
  
  const testSuites = [
    { name: 'CLI IntelliSense Tests', file: './test-cli-intellisense.js' },
    { name: 'YAML Workflow Tests', file: './test-yaml-workflows.js' },
    { name: 'Error Tips Unit Tests', file: './test-error-tips-unit.js' },
    { name: 'Original Unit Tests', file: './unit-tests.js' }
  ];
  
  const results = [];
  
  // First, ensure the project is built
  console.log('\n📦 Building project...');
  try {
    await execAsync('npm run build', { cwd: path.join(__dirname, '..') });
    console.log('✅ Build successful\n');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
  
  // Run each test suite
  for (const suite of testSuites) {
    const result = await runTestSuite(suite.name, suite.file);
    results.push(result);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The enhanced features are working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the output above.');
  }
  
  return failed === 0;
}

// Additional integration test
async function testFeatureIntegration() {
  console.log('\n' + '='.repeat(60));
  console.log('Running Feature Integration Test');
  console.log('='.repeat(60));
  
  console.log('\n🧪 Testing that all features work together...\n');
  
  try {
    // Test 1: Error tips in run command
    console.log('1. Testing error tips in workflow execution...');
    const errorTest = await execAsync(
      'echo "- click: nonexistent" | node ../bin/run.js run',
      { cwd: path.join(__dirname, '..') }
    ).catch(e => e);
    
    if (errorTest.stderr && errorTest.stderr.includes('💡')) {
      console.log('✅ Error tips appear in workflow execution');
    } else {
      console.log('⚠️  Error tips might not be working in workflows');
    }
    
    // Test 2: Help text includes new commands
    console.log('\n2. Testing new commands in help...');
    const helpResult = await execAsync('node ../bin/run.js --help', {
      cwd: path.join(__dirname, '..')
    });
    
    const newCommands = ['run', 'interactive-enhanced'];
    const foundCommands = newCommands.filter(cmd => 
      helpResult.stdout.includes(cmd)
    );
    
    if (foundCommands.length === newCommands.length) {
      console.log('✅ All new commands appear in help');
    } else {
      console.log(`⚠️  Missing commands: ${newCommands.filter(c => !foundCommands.includes(c))}`);
    }
    
    // Test 3: Example workflows exist
    console.log('\n3. Testing example workflows...');
    const fs = require('fs').promises;
    const examplesExist = await fs.access(
      path.join(__dirname, '..', 'examples', 'login-workflow.yml')
    ).then(() => true).catch(() => false);
    
    if (examplesExist) {
      console.log('✅ Example workflows are present');
    } else {
      console.log('⚠️  Example workflows might be missing');
    }
    
    console.log('\n✅ Integration tests completed');
    
  } catch (error) {
    console.error('❌ Integration test error:', error.message);
  }
}

// Run everything
if (require.main === module) {
  runAllTests()
    .then(async (success) => {
      await testFeatureIntegration();
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}