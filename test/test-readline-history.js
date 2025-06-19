#!/usr/bin/env node

/**
 * Test script to verify readline's built-in history functionality
 * This demonstrates how the improved interactive command manages history
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a test history file
const historyFile = path.join(os.tmpdir(), '.test_readline_history');

// Create readline interface with history support
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'test> ',
  historySize: 10,
  removeHistoryDuplicates: true,
});

console.log('Readline History Test');
console.log('====================');
console.log('Type some commands and use up/down arrows to navigate history');
console.log('Type "history" to see current history');
console.log('Type "exit" to quit\n');

// Load existing history
try {
  if (fs.existsSync(historyFile)) {
    const data = fs.readFileSync(historyFile, 'utf-8');
    const commands = data.split('\n').filter(line => line.trim());
    
    // Load in reverse order (readline stores newest first)
    for (let i = commands.length - 1; i >= 0; i--) {
      rl.history.push(commands[i]);
    }
    console.log(`Loaded ${commands.length} commands from history\n`);
  }
} catch (error) {
  console.error('Failed to load history:', error);
}

rl.prompt();

rl.on('line', (input) => {
  const trimmed = input.trim();
  
  if (trimmed === 'exit') {
    rl.close();
    return;
  }
  
  if (trimmed === 'history') {
    console.log('\nCurrent history (newest first):');
    rl.history.forEach((cmd, index) => {
      console.log(`  ${index + 1}: ${cmd}`);
    });
    console.log();
  } else if (trimmed) {
    console.log(`You typed: ${trimmed}`);
  }
  
  rl.prompt();
});

rl.on('close', () => {
  // Save history
  try {
    const history = [...rl.history].reverse(); // Convert to chronological order
    fs.writeFileSync(historyFile, history.join('\n'));
    console.log(`\nHistory saved to: ${historyFile}`);
  } catch (error) {
    console.error('Failed to save history:', error);
  }
  
  console.log('Goodbye!');
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  rl.close();
});