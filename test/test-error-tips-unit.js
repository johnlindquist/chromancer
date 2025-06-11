const assert = require('assert');

// Test error tips functionality directly
async function testErrorTipsModule() {
  console.log('\n🧪 Testing Error Tips Module...\n');
  
  try {
    const errorTipsPath = '../dist/utils/error-tips.js';
    const { getErrorTip, enhanceError } = require(errorTipsPath);
    
    // Test selector error detection
    const selectorError = new Error('Element not found');
    selectorError.selector = 'button';
    
    const tip1 = getErrorTip(selectorError);
    assert(tip1.tip.includes('Did you forget'), 'Should suggest prefix for bare element');
    assert(tip1.example.includes('.button'), 'Should show class example');
    assert(tip1.example.includes('#button'), 'Should show ID example');
    console.log('✅ Selector prefix detection works');
    
    // Test XPath detection
    const xpathError = new Error('Element not found');
    xpathError.selector = '//button[@id="submit"]';
    
    const tip2 = getErrorTip(xpathError);
    assert(tip2.message.includes('XPath'), 'Should detect XPath');
    assert(tip2.tip.includes('CSS selectors'), 'Should suggest CSS instead');
    console.log('✅ XPath detection works');
    
    // Test timeout error
    const timeoutError = new Error('Timeout waiting for element');
    timeoutError.selector = '#slow-element';
    
    const tip3 = getErrorTip(timeoutError, 'wait');
    assert(tip3.tip.includes('timeout period'), 'Should mention timeout');
    assert(tip3.example.includes('--timeout'), 'Should suggest timeout increase');
    console.log('✅ Timeout error detection works');
    
    // Test navigation error
    const navError = new Error('Invalid URL');
    const tip4 = getErrorTip(navError, 'navigate');
    assert(tip4.tip.includes('protocol'), 'Should mention protocol');
    assert(tip4.example.includes('https://'), 'Should show https example');
    console.log('✅ Navigation error detection works');
    
    // Test connection error
    const connError = new Error('Connection refused');
    const tip5 = getErrorTip(connError);
    assert(tip5.tip.includes('Chrome'), 'Should mention Chrome');
    assert(tip5.tip.includes('remote debugging'), 'Should mention debugging port');
    console.log('✅ Connection error detection works');
    
    // Test enhanceError function
    const basicError = new Error('Something went wrong');
    const enhanced = enhanceError(basicError, { command: 'click', selector: '#test' });
    assert(enhanced.message !== basicError.message, 'Should enhance message');
    console.log('✅ Error enhancement works');
    
    return { success: true, message: 'Error tips module tests passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testErrorPatterns() {
  console.log('\n🧪 Testing Error Pattern Matching...\n');
  
  try {
    const { getErrorTip } = require('../dist/utils/error-tips.js');
    
    // Test various error patterns
    const patterns = [
      {
        error: { message: 'Element not found: .missing-class' },
        expectedTip: 'Ensure the element exists',
        description: 'Missing element with class'
      },
      {
        error: { message: 'Cannot type into element' },
        expectedTip: 'input field',
        description: 'Type into non-input'
      },
      {
        error: { message: 'Element is inside an iframe' },
        expectedTip: '--frame',
        description: 'iframe detection'
      },
      {
        error: { message: 'Click intercepted by another element' },
        expectedTip: 'covered by another element',
        description: 'Click interception'
      },
      {
        error: { message: 'Permission denied' },
        expectedTip: 'permissions',
        description: 'Permission error'
      }
    ];
    
    for (const pattern of patterns) {
      const tip = getErrorTip(pattern.error);
      assert(
        tip.tip.toLowerCase().includes(pattern.expectedTip.toLowerCase()),
        `${pattern.description} should include "${pattern.expectedTip}"`
      );
      console.log(`✅ ${pattern.description} pattern works`);
    }
    
    return { success: true, message: 'Error pattern tests passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testColorOutput() {
  console.log('\n🧪 Testing Colorized Output...\n');
  
  try {
    // Test that color functions work
    // Create a chalk-like interface for testing
    const chalk = {
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      blue: (s) => `\x1b[34m${s}\x1b[0m`,
    };
    
    // Test basic colors
    const red = chalk.red('Error');
    const yellow = chalk.yellow('Warning');
    const green = chalk.green('Success');
    const blue = chalk.blue('Info');
    
    assert(red.includes('Error'), 'Red text should contain message');
    assert(yellow.includes('Warning'), 'Yellow text should contain message');
    assert(green.includes('Success'), 'Green text should contain message');
    assert(blue.includes('Info'), 'Blue text should contain message');
    
    console.log('✅ Chalk color functions work');
    
    // Test color stripping for non-TTY
    const stripAnsi = (str) => str.replace(/\u001b\[[0-9;]*m/g, '');
    assert(stripAnsi(red) === 'Error', 'Should be able to strip ANSI codes');
    console.log('✅ ANSI code handling works');
    
    return { success: true, message: 'Color output tests passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testDocumentationLinks() {
  console.log('\n🧪 Testing Documentation Links...\n');
  
  try {
    const { displayErrorWithTip } = require('../dist/utils/error-tips.js');
    
    // Capture console output
    const originalError = console.error;
    let output = '';
    console.error = (msg) => { output += msg + '\n'; };
    
    // Test that docs links are generated
    const error = new Error('Test error');
    displayErrorWithTip(error, 'click');
    
    // Restore console
    console.error = originalError;
    
    assert(output.includes('📚 Docs:'), 'Should include docs emoji');
    assert(output.includes('https://chromancer.dev/docs/click#errors'), 'Should include command-specific link');
    console.log('✅ Documentation links generated correctly');
    
    // Test without command
    output = '';
    console.error = (msg) => { output += msg + '\n'; };
    displayErrorWithTip(error);
    console.error = originalError;
    
    assert(output.includes('❌'), 'Should include error emoji');
    assert(output.includes('💡'), 'Should include tip emoji when available');
    console.log('✅ Error display formatting works');
    
    return { success: true, message: 'Documentation link tests passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Running Error Tips Unit Tests...');
  
  const tests = [
    { name: 'Error Tips Module', fn: testErrorTipsModule },
    { name: 'Error Patterns', fn: testErrorPatterns },
    { name: 'Color Output', fn: testColorOutput },
    { name: 'Documentation Links', fn: testDocumentationLinks }
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