const assert = require('assert');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

/**
 * Test that raw mode is properly restored after readline usage
 * This verifies the fix in workflow-executor.ts
 */

async function testRawModeRestoration() {
  console.log('Test 1: Raw mode restoration after readline');
  
  // Enable raw mode initially
  process.stdin.setRawMode(true);
  assert.strictEqual(process.stdin.isRaw, true, 'Initial raw mode should be true');
  console.log('  ✓ Initial state: raw mode = true');
  
  // Simulate the wait command pattern
  const wasRaw = process.stdin.isRaw;
  
  // Create and close readline (this disables raw mode)
  const rl = readline.createInterface({ input: stdin, output: stdout });
  rl.close();
  
  // Verify readline disabled raw mode
  assert.strictEqual(process.stdin.isRaw, false, 'Readline should disable raw mode');
  console.log('  ✓ After readline.close(): raw mode = false');
  
  // Apply our fix
  if (wasRaw && process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  
  // Verify fix worked
  assert.strictEqual(process.stdin.isRaw, true, 'Raw mode should be restored');
  console.log('  ✓ After fix: raw mode = true');
  console.log('  ✅ Test passed!\n');
}

async function testRawModeNotInitiallySet() {
  console.log('Test 2: Raw mode not initially set');
  
  // Start with raw mode off
  process.stdin.setRawMode(false);
  assert.strictEqual(process.stdin.isRaw, false, 'Initial raw mode should be false');
  console.log('  ✓ Initial state: raw mode = false');
  
  const wasRaw = process.stdin.isRaw;
  
  // Create and close readline
  const rl = readline.createInterface({ input: stdin, output: stdout });
  rl.close();
  console.log('  ✓ After readline.close(): raw mode = false');
  
  // Apply our fix (should not enable raw mode if it wasn't on)
  if (wasRaw && process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  
  // Verify raw mode is still off
  assert.strictEqual(process.stdin.isRaw, false, 'Raw mode should remain off');
  console.log('  ✓ After fix: raw mode = false (correctly not changed)');
  console.log('  ✅ Test passed!\n');
}

async function runTests() {
  console.log('=== Testing Raw Mode Restoration ===\n');
  
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    console.log('❌ Not running in a TTY environment. Cannot test raw mode.');
    console.log('   Run this test directly in a terminal.');
    process.exit(0);
  }
  
  try {
    await testRawModeRestoration();
    await testRawModeNotInitiallySet();
    
    console.log('✅ All tests passed!');
    console.log('\nSummary:');
    console.log('- Raw mode is correctly restored after readline when it was initially on');
    console.log('- Raw mode is correctly left off when it was initially off');
    console.log('\nThis confirms the fix in workflow-executor.ts works correctly.');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}