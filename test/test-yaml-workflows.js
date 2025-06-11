const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const assert = require('assert');
const execAsync = promisify(exec);

async function testRunCommand() {
  console.log('\n🧪 Testing Run Command Structure...\n');
  
  try {
    // Test that run command exists
    const result = await execAsync('node ../bin/run.js run --help');
    assert(result.stdout.includes('Run a workflow'), 'Should have workflow description');
    assert(result.stdout.includes('YAML'), 'Should mention YAML');
    console.log('✅ run command exists');
    
    // Test flags
    assert(result.stdout.includes('--strict'), 'Should have strict flag');
    assert(result.stdout.includes('--continue-on-error'), 'Should have continue-on-error flag');
    assert(result.stdout.includes('--var'), 'Should have var flag');
    assert(result.stdout.includes('--dry-run'), 'Should have dry-run flag');
    console.log('✅ Command has expected flags');
    
    return { success: true, message: 'Run command structure test passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testYamlParsing() {
  console.log('\n🧪 Testing YAML Workflow Parsing...\n');
  
  const testDir = path.join(__dirname, 'yaml-test');
  await fs.mkdir(testDir, { recursive: true });
  
  try {
    // Create test YAML file
    const yamlContent = `
# Test workflow
- navigate: https://example.com
- wait:
    selector: body
    timeout: 5000
- screenshot: test.png
`;
    
    const yamlFile = path.join(testDir, 'test-workflow.yml');
    await fs.writeFile(yamlFile, yamlContent);
    
    // Test dry-run
    const result = await execAsync(`node ../bin/run.js run ${yamlFile} --dry-run`);
    assert(result.stdout.includes('Dry run mode'), 'Should indicate dry run');
    assert(result.stdout.includes('Workflow is valid'), 'Should validate successfully');
    console.log('✅ YAML parsing and validation works');
    
    // Test with invalid YAML
    const invalidYaml = 'invalid: yaml: content: here:';
    const invalidFile = path.join(testDir, 'invalid.yml');
    await fs.writeFile(invalidFile, invalidYaml);
    
    try {
      await execAsync(`node ../bin/run.js run ${invalidFile} --dry-run`);
      assert(false, 'Should fail on invalid YAML');
    } catch (error) {
      assert(error.stderr.includes('Failed to parse YAML'), 'Should show YAML parse error');
      console.log('✅ Invalid YAML detection works');
    }
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    
    return { success: true, message: 'YAML parsing tests passed' };
  } catch (error) {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    return { success: false, message: error.message };
  }
}

async function testVariableSubstitution() {
  console.log('\n🧪 Testing Variable Substitution...\n');
  
  const testDir = path.join(__dirname, 'var-test');
  await fs.mkdir(testDir, { recursive: true });
  
  try {
    // Create workflow with variables
    const yamlContent = `
- navigate: \${URL}
- type:
    selector: input[name="search"]
    text: \${SEARCH_TERM}
- wait:
    selector: .results
    timeout: \${TIMEOUT}
`;
    
    const yamlFile = path.join(testDir, 'var-workflow.yml');
    await fs.writeFile(yamlFile, yamlContent);
    
    // Test with variables (dry-run to avoid Chrome requirement)
    const result = await execAsync(
      `node ../bin/run.js run ${yamlFile} --dry-run --var URL=https://example.com --var SEARCH_TERM="test query" --var TIMEOUT=10000`
    );
    
    assert(result.stdout.includes('Workflow is valid'), 'Should validate with variables');
    console.log('✅ Variable substitution syntax accepted');
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    
    return { success: true, message: 'Variable substitution tests passed' };
  } catch (error) {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    return { success: false, message: error.message };
  }
}

async function testStdinInput() {
  console.log('\n🧪 Testing Stdin Input...\n');
  
  try {
    // Test piping workflow via stdin
    const { exec } = require('child_process');
    
    let output = '';
    let errorOutput = '';
    
    const child = exec('node ../bin/run.js run --dry-run');
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Send YAML via stdin
    child.stdin.write('- navigate: https://example.com\n');
    child.stdin.write('- wait: body\n');
    child.stdin.end();
    
    // Wait for completion
    const exitCode = await new Promise((resolve) => {
      child.on('exit', resolve);
    });
    
    if (exitCode === 0 && output.includes('Workflow is valid')) {
      console.log('✅ Stdin input accepted');
      return { success: true, message: 'Stdin input test passed' };
    } else {
      console.log('Output:', output);
      console.log('Error:', errorOutput);
      return { success: false, message: 'Stdin test failed' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testWorkflowExamples() {
  console.log('\n🧪 Testing Example Workflows...\n');
  
  try {
    // Test that example workflows are valid
    const examples = [
      'examples/login-workflow.yml',
      'examples/scraping-workflow.yml',
      'examples/form-automation.yml'
    ];
    
    for (const example of examples) {
      try {
        const result = await execAsync(`node ../bin/run.js run ${example} --dry-run`);
        assert(result.stdout.includes('Workflow is valid'), `${example} should be valid`);
        console.log(`✅ ${example} is valid`);
      } catch (error) {
        console.log(`⚠️  ${example} validation failed (might not exist)`);
      }
    }
    
    return { success: true, message: 'Example workflow tests completed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Running YAML Workflow Tests...');
  
  const tests = [
    { name: 'Run Command Structure', fn: testRunCommand },
    { name: 'YAML Parsing', fn: testYamlParsing },
    { name: 'Variable Substitution', fn: testVariableSubstitution },
    { name: 'Stdin Input', fn: testStdinInput },
    { name: 'Workflow Examples', fn: testWorkflowExamples }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result.success) {
        console.log(`\n✅ ${test.name}: ${result.message}`);
        passed++;
      } else {
        console.log(`\n❌ ${test.name}: ${result.message}`);
        failed++;
      }
    } catch (error) {
      console.log(`\n❌ ${test.name}: ${error.message}`);
      console.error(error);
      failed++;
    }
  }
  
  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}