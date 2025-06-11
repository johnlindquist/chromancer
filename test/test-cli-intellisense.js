const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const assert = require('assert');

// Import command registry functions
async function testCommandRegistry() {
  console.log('\n🧪 Testing Command Registry...\n');
  
  try {
    // Test that registry exports are available
    const registryPath = '../dist/commands/registry.js';
    const registry = require(registryPath);
    
    // Test getCommandNames
    const commands = registry.getCommandNames();
    assert(Array.isArray(commands), 'getCommandNames should return an array');
    assert(commands.length > 20, 'Should have at least 20 commands');
    assert(commands.includes('navigate'), 'Should include navigate command');
    assert(commands.includes('click'), 'Should include click command');
    console.log('✅ getCommandNames works correctly');
    console.log(`   Found ${commands.length} commands`);
    
    // Test getCommandSchema
    const navigateSchema = registry.getCommandSchema('navigate');
    assert(navigateSchema, 'Should return schema for navigate');
    assert(navigateSchema.name === 'navigate', 'Schema should have correct name');
    assert(navigateSchema.description, 'Schema should have description');
    assert(navigateSchema.flags, 'Schema should have flags');
    console.log('✅ getCommandSchema works correctly');
    
    // Test fuzzySearch
    const searchResults = registry.fuzzySearch('nav', commands);
    assert(searchResults.includes('navigate'), 'Fuzzy search should find navigate');
    assert(searchResults[0] === 'navigate', 'Navigate should be first for "nav"');
    console.log('✅ fuzzySearch works correctly');
    
    // Test getFlagCompletions
    const flagCompletions = registry.getFlagCompletions('navigate', '--w');
    assert(Array.isArray(flagCompletions), 'Should return array of flag completions');
    assert(flagCompletions.some(f => f === '--wait-until'), 'Should include --wait-until');
    console.log('✅ getFlagCompletions works correctly');
    
    // Test schema extraction details
    const clickSchema = registry.getCommandSchema('click');
    assert(clickSchema.flags.selector, 'Click should have selector flag');
    assert(clickSchema.flags.selector.required === true, 'Selector should be required');
    assert(clickSchema.flags.button, 'Click should have button flag');
    assert(clickSchema.flags.button.options, 'Button flag should have options');
    console.log('✅ Schema extraction includes flag details');
    
    return { success: true, message: 'Command registry tests passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testInteractiveEnhanced() {
  console.log('\n🧪 Testing Interactive Enhanced Command...\n');
  
  try {
    // Test that interactive-enhanced command exists
    const result = await execAsync('node ../bin/run.js interactive-enhanced --help');
    assert(result.stdout.includes('Enhanced interactive mode'), 'Should have enhanced description');
    assert(result.stdout.includes('IntelliSense'), 'Should mention IntelliSense');
    console.log('✅ interactive-enhanced command exists');
    
    // Test command structure
    assert(result.stdout.includes('--port'), 'Should have port flag');
    assert(result.stdout.includes('--launch'), 'Should have launch flag');
    console.log('✅ Command has expected flags');
    
    return { success: true, message: 'Interactive enhanced tests passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testSchemaTypes() {
  console.log('\n🧪 Testing Schema Type Definitions...\n');
  
  try {
    const schemaPath = '../dist/types/schema.js';
    const schemaModule = require(schemaPath);
    
    // Test extractFlagSchema function
    const testFlag = {
      name: 'test',
      char: 't',
      description: 'Test flag',
      required: true,
      type: 'string',
      options: ['a', 'b', 'c']
    };
    
    const extracted = schemaModule.extractFlagSchema(testFlag);
    assert(extracted.name === 'test', 'Should extract name');
    assert(extracted.char === 't', 'Should extract char');
    assert(extracted.required === true, 'Should extract required');
    assert(Array.isArray(extracted.options), 'Should extract options');
    console.log('✅ extractFlagSchema works correctly');
    
    // Test extractCommandSchema with mock command
    const mockCommand = {
      id: 'test-command',
      description: 'Test command description',
      flags: {
        verbose: { description: 'Verbose output', type: 'boolean' },
        file: { description: 'Input file', type: 'string', required: true }
      },
      args: {
        input: { description: 'Input argument', required: true }
      }
    };
    
    const commandSchema = schemaModule.extractCommandSchema(mockCommand);
    assert(commandSchema.name === 'test-command', 'Should extract command name');
    assert(commandSchema.description === 'Test command description', 'Should extract description');
    assert(Object.keys(commandSchema.flags).length === 2, 'Should extract all flags');
    assert(commandSchema.args, 'Should extract args');
    console.log('✅ extractCommandSchema works correctly');
    
    return { success: true, message: 'Schema type tests passed' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Running CLI IntelliSense Tests...');
  
  const tests = [
    { name: 'Command Registry', fn: testCommandRegistry },
    { name: 'Interactive Enhanced', fn: testInteractiveEnhanced },
    { name: 'Schema Types', fn: testSchemaTypes }
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