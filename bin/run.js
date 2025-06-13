#!/usr/bin/env node

const oclif = require('@oclif/core')

// If no command is provided, default to 'ai'
const args = process.argv.slice(2)

// Check if first argument is not a known command
// If it's not a command (doesn't match a file in commands/), treat it as AI instruction
const fs = require('fs')
const path = require('path')

const commandsDir = path.join(__dirname, '..', 'dist', 'commands')
const isKnownCommand = args[0] && fs.existsSync(path.join(commandsDir, args[0] + '.js'))

if (args.length === 0 || (args[0] && !isKnownCommand)) {
  // No command provided or first arg is not a known command
  // Insert 'ai' as the command
  process.argv.splice(2, 0, 'ai')
}

oclif.run().then(require('@oclif/core/flush')).catch(require('@oclif/core/handle'))