import { Flags } from '@oclif/core'

export interface CommandSchema {
  name: string
  description: string
  flags: Record<string, any>
  args?: Record<string, any>
  examples?: string[]
}

export interface FlagSchema {
  name: string
  char?: string
  description: string
  required: boolean
  type: 'string' | 'boolean' | 'integer'
  options?: string[]
  default?: any
  multiple?: boolean
}

export interface ArgSchema {
  name: string
  description: string
  required: boolean
  options?: string[]
}

export function extractFlagSchema(flag: any): FlagSchema {
  return {
    name: flag.name,
    char: flag.char,
    description: flag.description || '',
    required: flag.required || false,
    type: flag.type || 'string',
    options: flag.options,
    default: flag.default,
    multiple: flag.multiple || false,
  }
}

export function extractCommandSchema(command: any): CommandSchema {
  const flags: Record<string, FlagSchema> = {}
  const args: Record<string, ArgSchema> = {}
  
  // Extract flags
  if (command.flags) {
    for (const [name, flag] of Object.entries(command.flags)) {
      if (name !== 'json' && flag) { // Skip oclif's built-in json flag
        flags[name] = extractFlagSchema({ name, ...flag })
      }
    }
  }
  
  // Extract args
  if (command.args) {
    for (const [name, arg] of Object.entries(command.args)) {
      if (arg) {
        args[name] = {
          name,
          description: (arg as any).description || '',
          required: (arg as any).required || false,
          options: (arg as any).options,
        }
      }
    }
  }
  
  return {
    name: command.id || command.name,
    description: command.description || '',
    flags,
    args: Object.keys(args).length > 0 ? args : undefined,
    examples: command.examples,
  }
}