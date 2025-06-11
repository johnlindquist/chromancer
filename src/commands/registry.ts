import { CommandSchema, extractCommandSchema } from '../types/schema.js'

// Import all commands
import Assert from './assert.js'
import Click from './click.js'
import Cookies from './cookies.js'
import Evaluate from './evaluate.js'
import Export from './export.js'
import Fill from './fill.js'
import Hover from './hover.js'
import Interactive from './interactive.js'
import Navigate from './navigate.js'
import Network from './network.js'
import Pdf from './pdf.js'
import Record from './record.js'
import Repl from './repl.js'
import Screenshot from './screenshot.js'
import Scroll from './scroll.js'
import Select from './select.js'
// Session is an alias, using Repl instead
const Session = Repl
import Sessions from './sessions.js'
import Spawn from './spawn.js'
import Stop from './stop.js'
import Store from './store.js'
import Type from './type.js'
import Wait from './wait.js'
import WaitForLogin from './wait-for-login.js'

// Command map
export const commands = {
  assert: Assert,
  click: Click,
  cookies: Cookies,
  evaluate: Evaluate,
  export: Export,
  fill: Fill,
  hover: Hover,
  interactive: Interactive,
  navigate: Navigate,
  network: Network,
  pdf: Pdf,
  record: Record,
  repl: Repl,
  screenshot: Screenshot,
  scroll: Scroll,
  select: Select,
  session: Session,
  sessions: Sessions,
  spawn: Spawn,
  stop: Stop,
  store: Store,
  type: Type,
  wait: Wait,
  'wait-for-login': WaitForLogin,
}

// Extract schemas
export const commandSchemas: { [key: string]: CommandSchema } = {}

for (const [name, CommandClass] of Object.entries(commands)) {
  commandSchemas[name] = extractCommandSchema(CommandClass)
}

// Helper functions for autocomplete
export function getCommandNames(): string[] {
  return Object.keys(commands)
}

export function getCommandSchema(commandName: string): CommandSchema | undefined {
  return commandSchemas[commandName]
}

export function fuzzySearch(input: string, items: string[]): string[] {
  const lowerInput = input.toLowerCase()
  return items
    .filter(item => item.toLowerCase().includes(lowerInput))
    .sort((a, b) => {
      // Prioritize exact starts
      const aStarts = a.toLowerCase().startsWith(lowerInput)
      const bStarts = b.toLowerCase().startsWith(lowerInput)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.localeCompare(b)
    })
}

export function getFlagCompletions(commandName: string, currentInput: string): string[] {
  const schema = getCommandSchema(commandName)
  if (!schema || !schema.flags) return []
  
  const completions: string[] = []
  
  for (const [flagName, flagSchema] of Object.entries(schema.flags)) {
    // Add long form
    if (!currentInput || `--${flagName}`.startsWith(currentInput)) {
      completions.push(`--${flagName}`)
    }
    
    // Add short form if available
    if (flagSchema.char && (!currentInput || `-${flagSchema.char}`.startsWith(currentInput))) {
      completions.push(`-${flagSchema.char}`)
    }
  }
  
  return completions
}

export function getArgCompletions(commandName: string, argIndex: number): string[] | undefined {
  const schema = getCommandSchema(commandName)
  if (!schema || !schema.args) return undefined
  
  const argNames = Object.keys(schema.args)
  if (argIndex >= argNames.length) return undefined
  
  const argName = argNames[argIndex]
  const argSchema = schema.args[argName]
  
  return argSchema.options
}