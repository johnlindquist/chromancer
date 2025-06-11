import { Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface CommandHistory {
  push(cmd: string): void
  get(index: number): string | undefined
  length: number
}

export default class Interactive extends BaseCommand {
  static description = 'Launch an interactive REPL with command history, tab completion, and real-time browser control - explore pages interactively with full CDP access'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 9222',
    '<%= config.bin %> <%= command.id %> --launch --profile work',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
  }

  private rl?: readline.Interface
  private historyFile: string
  private commandHistory: string[] = []
  private historyIndex: number = -1
  private commands = {
    navigate: 'Navigate to a URL',
    click: 'Click on an element',
    type: 'Type text into an element',
    evaluate: 'Evaluate JavaScript in the browser',
    screenshot: 'Take a screenshot',
    select: 'Select elements on the page',
    wait: 'Wait for an element or condition',
    hover: 'Hover over an element',
    back: 'Go back in browser history',
    forward: 'Go forward in browser history',
    reload: 'Reload the current page',
    url: 'Get the current URL',
    title: 'Get the page title',
    cookies: 'List all cookies',
    viewport: 'Set or get viewport size',
    login: 'Navigate and wait for login',
    help: 'Show available commands',
    clear: 'Clear the console',
    exit: 'Exit interactive mode',
    quit: 'Exit interactive mode',
  }

  constructor(argv: string[], config: any) {
    super(argv, config)
    this.historyFile = path.join(os.homedir(), '.chromancer_history')
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Interactive)
    
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

    // Setup readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'chromancer> ',
      completer: this.completer.bind(this),
    })

    // Setup key bindings for history navigation
    this.setupKeyBindings()

    this.log('✨ Interactive CDP session started')
    this.log('Type "help" for available commands, "exit" to quit')
    this.log('')

    // Display prompt
    this.rl.prompt()

    // Handle line input
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim()
      
      if (trimmedInput) {
        // Add to history
        this.addToHistory(trimmedInput)
        
        try {
          await this.executeCommand(trimmedInput)
        } catch (error: any) {
          this.log(`❌ Error: ${error.message}`)
          this.logVerbose('Command execution error', error)
        }
      }
      
      this.rl?.prompt()
    })

    // Handle close
    this.rl.on('close', () => {
      this.saveHistory()
      this.log('\n👋 Goodbye!')
      process.exit(0)
    })
  }

  private setupKeyBindings(): void {
    if (!this.rl) return

    // Override keypress handling for history navigation
    process.stdin.on('keypress', (str, key) => {
      if (!key) return

      if (key.name === 'up') {
        // Navigate backward in history
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++
          const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex]
          if (cmd && this.rl) {
            this.rl.write(null, { ctrl: true, name: 'u' }) // Clear current line
            this.rl.write(cmd)
          }
        }
      } else if (key.name === 'down') {
        // Navigate forward in history
        if (this.historyIndex > 0) {
          this.historyIndex--
          const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex]
          if (cmd && this.rl) {
            this.rl.write(null, { ctrl: true, name: 'u' }) // Clear current line
            this.rl.write(cmd)
          }
        } else if (this.historyIndex === 0) {
          // Clear the line when reaching the end of history
          this.historyIndex = -1
          if (this.rl) {
            this.rl.write(null, { ctrl: true, name: 'u' }) // Clear current line
          }
        }
      }
    })
  }

  private completer(line: string): [string[], string] {
    const completions = Object.keys(this.commands)
    const hits = completions.filter((c) => c.startsWith(line))
    return [hits.length ? hits : completions, line]
  }

  private async executeCommand(input: string): Promise<void> {
    const parts = input.split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (command) {
      case 'help':
        this.showHelp()
        break

      case 'clear':
        console.clear()
        break

      case 'exit':
      case 'quit':
        this.rl?.close()
        break

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

      case 'select':
        const selectSelector = args.join(' ') || '*'
        await this.select(selectSelector)
        break

      case 'wait':
        if (args.length === 0) {
          this.log('Usage: wait <selector>')
          return
        }
        await this.wait(args.join(' '))
        break

      case 'hover':
        if (args.length === 0) {
          this.log('Usage: hover <selector>')
          return
        }
        await this.hover(args.join(' '))
        break

      case 'back':
        await this.goBack()
        break

      case 'forward':
        await this.goForward()
        break

      case 'reload':
      case 'refresh':
        await this.reload()
        break

      case 'url':
        await this.showUrl()
        break

      case 'title':
        await this.showTitle()
        break

      case 'cookies':
        await this.showCookies()
        break

      case 'viewport':
        if (args.length >= 2) {
          const width = parseInt(args[0])
          const height = parseInt(args[1])
          await this.setViewport(width, height)
        } else {
          await this.showViewport()
        }
        break

      case 'login':
        if (args.length === 0) {
          this.log('Usage: login <url> [ready-selector]')
          return
        }
        const loginUrl = args[0]
        const readySelector = args[1]
        await this.waitForLogin(loginUrl, readySelector)
        break

      default:
        this.log(`Unknown command: ${command}`)
        this.log('Type "help" for available commands')
    }
  }

  private showHelp(): void {
    this.log('\nAvailable commands:')
    this.log('')
    
    Object.entries(this.commands).forEach(([cmd, desc]) => {
      this.log(`  ${cmd.padEnd(15)} ${desc}`)
    })
    
    this.log('')
    this.log('Examples:')
    this.log('  navigate https://example.com')
    this.log('  click button.submit')
    this.log('  type input[name="search"] hello world')
    this.log('  evaluate document.title')
    this.log('  screenshot output.png')
    this.log('  wait .loading-complete')
    this.log('  hover .dropdown-menu')
    this.log('  login https://gmail.com')
    this.log('')
  }

  private async navigate(url: string): Promise<void> {
    if (!this.page) return
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    this.log(`🌐 Navigating to ${url}...`)
    await this.page.goto(url, { waitUntil: 'load' })
    this.log(`✅ Navigated to ${url}`)
  }

  private async click(selector: string): Promise<void> {
    if (!this.page) return
    
    this.log(`🖱️  Clicking ${selector}...`)
    await this.page.click(selector)
    this.log(`✅ Clicked ${selector}`)
  }

  private async type(selector: string, text: string): Promise<void> {
    if (!this.page) return
    
    this.log(`⌨️  Typing into ${selector}...`)
    await this.page.type(selector, text)
    this.log(`✅ Typed "${text}" into ${selector}`)
  }

  private async evaluate(code: string): Promise<void> {
    if (!this.page) return
    
    try {
      const result = await this.page.evaluate(code)
      this.log('📤 Result:', JSON.stringify(result, null, 2))
    } catch (error: any) {
      this.log('❌ Evaluation error:', error.message)
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
    this.log(`✅ Screenshot saved to ${filename}`)
  }

  private async select(selector: string): Promise<void> {
    if (!this.page) return
    
    try {
      const count = await this.page.locator(selector).count()
      this.log(`🔍 Found ${count} elements matching "${selector}"`)
      
      if (count > 0 && count <= 10) {
        // Show details for up to 10 elements
        for (let i = 0; i < count; i++) {
          const element = this.page.locator(selector).nth(i)
          const tagName = await element.evaluate(el => el.tagName.toLowerCase())
          const text = await element.textContent() || ''
          const className = await element.getAttribute('class') || ''
          
          this.log(`[${i}] <${tagName}${className ? ` class="${className}"` : ''}> ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`)
        }
      }
    } catch (error: any) {
      this.log('❌ Selection error:', error.message)
    }
  }

  private async wait(selector: string): Promise<void> {
    if (!this.page) return
    
    this.log(`⏳ Waiting for ${selector}...`)
    await this.page.waitForSelector(selector, { state: 'visible' })
    this.log(`✅ Element ${selector} is visible`)
  }

  private async hover(selector: string): Promise<void> {
    if (!this.page) return
    
    this.log(`🎯 Hovering over ${selector}...`)
    await this.page.hover(selector)
    this.log(`✅ Hovered over ${selector}`)
  }

  private async goBack(): Promise<void> {
    if (!this.page) return
    
    this.log('⬅️  Going back...')
    await this.page.goBack()
    this.log('✅ Navigated back')
  }

  private async goForward(): Promise<void> {
    if (!this.page) return
    
    this.log('➡️  Going forward...')
    await this.page.goForward()
    this.log('✅ Navigated forward')
  }

  private async reload(): Promise<void> {
    if (!this.page) return
    
    this.log('🔄 Reloading page...')
    await this.page.reload()
    this.log('✅ Page reloaded')
  }

  private async showUrl(): Promise<void> {
    if (!this.page) return
    
    const url = this.page.url()
    this.log('🔗 Current URL:', url)
  }

  private async showTitle(): Promise<void> {
    if (!this.page) return
    
    const title = await this.page.title()
    this.log('📄 Page title:', title)
  }

  private async showCookies(): Promise<void> {
    if (!this.page) return
    
    const cookies = await this.page.context().cookies()
    this.log(`🍪 Found ${cookies.length} cookies:`)
    
    cookies.forEach(cookie => {
      this.log(`  ${cookie.name}: ${cookie.value.substring(0, 50)}${cookie.value.length > 50 ? '...' : ''}`)
    })
  }

  private async setViewport(width: number, height: number): Promise<void> {
    if (!this.page) return
    
    await this.page.setViewportSize({ width, height })
    this.log(`✅ Viewport set to ${width}x${height}`)
  }

  private async showViewport(): Promise<void> {
    if (!this.page) return
    
    const viewport = this.page.viewportSize()
    if (viewport) {
      this.log('📐 Current viewport:', `${viewport.width}x${viewport.height}`)
    } else {
      this.log('No viewport set')
    }
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
    this.historyIndex = -1 // Reset history navigation
  }

  async finally(): Promise<void> {
    if (this.rl) {
      this.rl.close()
    }
    this.saveHistory()
    await super.finally()
  }
}