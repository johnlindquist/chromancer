import { Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import inquirer from 'inquirer'
import autocompletePrompt from 'inquirer-autocomplete-prompt'
import chalk from 'chalk'
import { 
  getCommandNames, 
  getCommandSchema, 
  fuzzySearch, 
  getFlagCompletions,
  getArgCompletions 
} from './registry.js'

// Register the autocomplete prompt
inquirer.registerPrompt('autocomplete', autocompletePrompt)

interface ParsedCommand {
  command: string
  args: string[]
  flags: Record<string, any>
}

export default class InteractiveEnhanced extends BaseCommand {
  static description = 'Enhanced interactive mode with IntelliSense-like command completion'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 9222',
    '<%= config.bin %> <%= command.id %> --launch --profile work',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
  }

  private historyFile: string
  private commandHistory: string[] = []

  constructor(argv: string[], config: any) {
    super(argv, config)
    this.historyFile = path.join(os.homedir(), '.chromancer_history')
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(InteractiveEnhanced)
    
    // Connect to Chrome
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      true // Always keep open in interactive mode
    )
    
    if (!this.page) {
      this.error('No page available')
    }

    // Load command history
    this.loadHistory()

    this.log(chalk.cyan('✨ Enhanced Interactive CDP session started'))
    this.log(chalk.gray('Type commands with auto-completion, Ctrl+C to exit'))
    this.log('')

    // Main command loop
    let running = true
    while (running) {
      try {
        const input = await this.promptForCommand()
        
        if (!input || input.trim() === '') continue
        
        const trimmedInput = input.trim()
        
        // Add to history
        this.addToHistory(trimmedInput)
        
        // Parse and execute command
        if (trimmedInput === 'exit' || trimmedInput === 'quit') {
          running = false
        } else if (trimmedInput === 'help') {
          this.showHelp()
        } else if (trimmedInput === 'clear') {
          console.clear()
        } else {
          await this.executeCommand(trimmedInput)
        }
      } catch (error: any) {
        if (error.message?.includes('SIGINT')) {
          running = false
        } else {
          this.log(chalk.red(`❌ Error: ${error.message}`))
          if (flags.verbose) {
            console.error(error)
          }
        }
      }
    }

    this.saveHistory()
    this.log(chalk.yellow('\n👋 Goodbye!'))
  }

  private async promptForCommand(): Promise<string> {
    const response = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'command',
        message: chalk.green('chromancer>'),
        source: async (answersSoFar: any, input: string) => {
          if (!input) {
            // Show all available commands
            return this.formatCommandList(getCommandNames())
          }

          // Parse current input to understand context
          const context = this.parseInputContext(input)
          
          if (context.type === 'command') {
            // Fuzzy search commands
            const matches = fuzzySearch(input, getCommandNames())
            return this.formatCommandList(matches)
          } else if (context.type === 'flag') {
            // Show flag completions
            const flags = getFlagCompletions(context.command, context.currentWord)
            return this.formatFlagList(context.command, flags)
          } else if (context.type === 'arg') {
            // Show arg completions if available
            const args = getArgCompletions(context.command, context.argIndex)
            if (args) {
              return args
            }
          }
          
          return []
        },
        pageSize: 15,
        searchText: 'Type to search commands...',
        emptyText: 'No matching commands found',
      }
    ])

    return response.command
  }

  private parseInputContext(input: string): any {
    const parts = input.split(/\s+/)
    const lastPart = parts[parts.length - 1] || ''
    
    // If only one part or first part is incomplete, we're typing a command
    if (parts.length === 1 || (parts.length === 1 && !getCommandNames().includes(parts[0]))) {
      return { type: 'command' }
    }
    
    // Extract command (first valid command in parts)
    const command = parts.find(p => getCommandNames().includes(p))
    if (!command) {
      return { type: 'command' }
    }
    
    // If last part starts with -, we're typing a flag
    if (lastPart.startsWith('-')) {
      return { 
        type: 'flag', 
        command, 
        currentWord: lastPart 
      }
    }
    
    // Otherwise, we're typing an argument
    // Count non-flag arguments
    let argIndex = 0
    for (let i = 1; i < parts.length; i++) {
      if (!parts[i].startsWith('-')) {
        argIndex++
      }
    }
    
    return { 
      type: 'arg', 
      command, 
      argIndex: argIndex - 1 
    }
  }

  private formatCommandList(commands: string[]): string[] {
    return commands.map(cmd => {
      const schema = getCommandSchema(cmd)
      if (schema) {
        return `${chalk.cyan(cmd)} - ${chalk.gray(schema.description)}`
      }
      return chalk.cyan(cmd)
    })
  }

  private formatFlagList(commandName: string, flags: string[]): string[] {
    const schema = getCommandSchema(commandName)
    if (!schema || !schema.flags) return flags
    
    return flags.map(flag => {
      const flagName = flag.replace(/^--?/, '')
      const isShort = flag.startsWith('-') && !flag.startsWith('--')
      
      // Find the flag schema
      let flagSchema: any
      if (isShort) {
        // Find by char
        flagSchema = Object.values(schema.flags).find((f: any) => f.char === flagName)
      } else {
        flagSchema = schema.flags[flagName]
      }
      
      if (flagSchema) {
        const required = flagSchema.required ? chalk.red('*') : ''
        const type = chalk.blue(`<${flagSchema.type}>`)
        const desc = chalk.gray(flagSchema.description || '')
        return `${chalk.green(flag)}${required} ${type} - ${desc}`
      }
      
      return chalk.green(flag)
    })
  }

  private async executeCommand(input: string): Promise<void> {
    const parts = input.split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    // Handle built-in interactive commands
    switch (command) {
      case 'navigate':
      case 'goto':
        if (args.length === 0) {
          this.log('Usage: navigate <url>')
          return
        }
        await this.navigate(args[0])
        break

      case 'click':
        if (args.length === 0) {
          this.log('Usage: click <selector>')
          return
        }
        await this.click(args.join(' '))
        break

      case 'type':
        if (args.length < 2) {
          this.log('Usage: type <selector> <text>')
          return
        }
        const selector = args[0]
        const text = args.slice(1).join(' ')
        await this.type(selector, text)
        break

      case 'evaluate':
      case 'eval':
        if (args.length === 0) {
          this.log('Usage: evaluate <javascript>')
          return
        }
        await this.evaluate(args.join(' '))
        break

      case 'screenshot':
        const filename = args[0] || `screenshot-${Date.now()}.png`
        await this.screenshot(filename)
        break

      case 'wait':
        if (args.length === 0) {
          this.log('Usage: wait <selector>')
          return
        }
        await this.wait(args.join(' '))
        break

      case 'url':
        await this.showUrl()
        break

      case 'title':
        await this.showTitle()
        break

      default:
        // Try to execute as a full chromancer command
        try {
          const { execSync } = await import('child_process')
          const result = execSync(`node ${process.argv[1]} ${input}`, {
            stdio: 'pipe',
            encoding: 'utf-8'
          })
          this.log(result.toString())
        } catch (error: any) {
          this.log(chalk.red(`Unknown command: ${command}`))
          this.log(chalk.gray('Type "help" for available commands'))
        }
    }
  }

  private showHelp(): void {
    this.log(chalk.cyan('\nAvailable commands:'))
    this.log('')
    
    const commands = getCommandNames()
    commands.forEach(cmd => {
      const schema = getCommandSchema(cmd)
      if (schema) {
        this.log(`  ${chalk.green(cmd.padEnd(15))} ${chalk.gray(schema.description)}`)
      }
    })
    
    this.log('')
    this.log(chalk.cyan('Interactive shortcuts:'))
    this.log(`  ${chalk.green('clear'.padEnd(15))} ${chalk.gray('Clear the console')}`)
    this.log(`  ${chalk.green('help'.padEnd(15))} ${chalk.gray('Show this help')}`)
    this.log(`  ${chalk.green('exit'.padEnd(15))} ${chalk.gray('Exit interactive mode')}`)
    
    this.log('')
    this.log(chalk.cyan('Tips:'))
    this.log(chalk.gray('  • Use TAB to autocomplete commands and flags'))
    this.log(chalk.gray('  • Required flags are marked with ' + chalk.red('*')))
    this.log(chalk.gray('  • Use arrow keys to navigate suggestions'))
    this.log('')
  }

  private async navigate(url: string): Promise<void> {
    if (!this.page) return
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      url = 'https://' + url
    }
    
    this.log(`🌐 Navigating to ${url}...`)
    await this.page.goto(url, { waitUntil: 'load' })
    this.log(chalk.green(`✅ Navigated to ${url}`))
  }

  private async click(selector: string): Promise<void> {
    if (!this.page) return
    
    this.log(`🖱️  Clicking ${selector}...`)
    await this.page.click(selector)
    this.log(chalk.green(`✅ Clicked ${selector}`))
  }

  private async type(selector: string, text: string): Promise<void> {
    if (!this.page) return
    
    this.log(`⌨️  Typing into ${selector}...`)
    await this.page.type(selector, text)
    this.log(chalk.green(`✅ Typed "${text}" into ${selector}`))
  }

  private async evaluate(code: string): Promise<void> {
    if (!this.page) return
    
    try {
      const result = await this.page.evaluate(code)
      this.log('📤 Result:', JSON.stringify(result, null, 2))
    } catch (error: any) {
      this.log(chalk.red('❌ Evaluation error:'), error.message)
    }
  }

  private async screenshot(filename: string): Promise<void> {
    if (!this.page) return
    
    // Ensure filename has proper extension
    if (!filename.match(/\.(png|jpg|jpeg|webp)$/i)) {
      filename += '.png'
    }
    
    this.log(`📸 Taking screenshot...`)
    await this.page.screenshot({ path: filename, fullPage: true })
    this.log(chalk.green(`✅ Screenshot saved to ${filename}`))
  }

  private async wait(selector: string): Promise<void> {
    if (!this.page) return
    
    this.log(`⏳ Waiting for ${selector}...`)
    await this.page.waitForSelector(selector, { state: 'visible' })
    this.log(chalk.green(`✅ Element ${selector} is visible`))
  }

  private async showUrl(): Promise<void> {
    if (!this.page) return
    
    const url = this.page.url()
    this.log('🔗 Current URL:', chalk.blue(url))
  }

  private async showTitle(): Promise<void> {
    if (!this.page) return
    
    const title = await this.page.title()
    this.log('📄 Page title:', chalk.blue(title))
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf-8')
        this.commandHistory = data.split('\n').filter(line => line.trim())
      }
    } catch (error) {
      // Ignore history load errors
    }
  }

  private saveHistory(): void {
    try {
      const historyData = this.commandHistory.slice(-1000).join('\n') // Keep last 1000 commands
      fs.writeFileSync(this.historyFile, historyData)
    } catch (error) {
      // Ignore history save errors
    }
  }

  private addToHistory(command: string): void {
    // Don't add duplicate consecutive commands
    if (this.commandHistory.length === 0 || this.commandHistory[this.commandHistory.length - 1] !== command) {
      this.commandHistory.push(command)
    }
  }
}