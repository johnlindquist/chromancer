import { Command, Flags } from '@oclif/core'
import { chromium, Browser, Page, BrowserContext } from 'playwright'
import { SessionManager } from './session.js'
import * as path from 'path'
import * as os from 'os'
import { displayErrorWithTip, enhanceError } from './utils/error-tips.js'
import { scanForChromeInstances } from './utils/chrome-scanner.js'
import ora from 'ora'

export abstract class BaseCommand extends Command {
  static baseFlags = {
    port: Flags.integer({
      char: 'p',
      description: 'Chrome debugging port',
      default: 9222,
    }),
    host: Flags.string({
      char: 'h',
      description: 'Chrome debugging host',
      default: 'localhost',
    }),
    launch: Flags.boolean({
      char: 'l',
      description: 'Launch Chrome automatically',
      default: false,
    }),
    profile: Flags.string({
      description: 'Chrome profile name or path to use',
    }),
    headless: Flags.boolean({
      description: 'Run Chrome in headless mode',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Enable verbose logging for debugging',
      default: false,
    }),
    keepOpen: Flags.boolean({
      char: 'k',
      description: 'Keep Chrome open after the command (only relevant when this command launches Chrome)',
      default: false,
      allowNo: true,
    }),
  }

  protected browser?: Browser
  protected context?: BrowserContext
  protected page?: Page
  private isLaunched = false
  protected verbose = false
  private keepOpen = false

  protected logVerbose(message: string, data?: any): void {
    if (this.verbose) {
      const timestamp = new Date().toISOString()
      const prefix = `[${timestamp}] [VERBOSE]`
      if (data) {
        this.log(`${prefix} ${message}`, JSON.stringify(data, null, 2))
      } else {
        this.log(`${prefix} ${message}`)
      }
    }
  }

  private getProfilePath(profileName: string): string {
    // If it's already an absolute path, use it
    if (path.isAbsolute(profileName)) {
      return profileName
    }

    // Otherwise, create profile in user's home directory
    const platform = process.platform
    let profileBase: string

    if (platform === 'win32') {
      profileBase = path.join(os.homedir(), 'AppData', 'Local', 'chromancer', 'profiles')
    } else if (platform === 'darwin') {
      profileBase = path.join(os.homedir(), 'Library', 'Application Support', 'chromancer', 'profiles')
    } else {
      profileBase = path.join(os.homedir(), '.config', 'chromancer', 'profiles')
    }

    return path.join(profileBase, profileName)
  }

  async connectToChrome(
    port: number = 9222,
    host: string = 'localhost',
    launch: boolean = false,
    profile?: string,
    headless: boolean = false,
    verbose: boolean = false,
    keepOpen: boolean = true
  ): Promise<void> {
    this.verbose = verbose
    // If we *attach* to external Chrome, always auto‑disconnect unless
    // the caller explicitly passed --keepOpen
    this.keepOpen = launch ? keepOpen : false
    const startTime = Date.now()
    
    this.logVerbose('Starting Chrome connection process', { port, host, launch, profile, headless })
    
    const browserURL = `http://${host}:${port}`
    
    const connectSpinner = ora(`🔍 Attempting to connect to Chrome at ${browserURL}...`).start()
    
    try {
      // First try to connect to existing Chrome instance
      this.browser = await chromium.connectOverCDP(browserURL)
      this.context = this.browser.contexts()[0]
      
      connectSpinner.succeed('✅ Connected to existing Chrome instance')
      this.logVerbose(`Connection successful in ${Date.now() - startTime}ms`)
    } catch (connectError: any) {
      connectSpinner.fail(`❌ No existing Chrome instance found at ${browserURL}`)
      this.logVerbose('Connection failed', { error: connectError.message })
      
      // Scan for Chrome instances on other ports
      this.log(`🔍 Scanning for Chrome instances on other ports...`)
      const instances = await scanForChromeInstances(host)
      
      if (instances.length > 0) {
        this.log(`\n✨ Found Chrome instance(s) on different port(s):`)
        for (const instance of instances) {
          this.log(`   Port ${instance.port}: ${instance.version?.Browser || 'Chrome'}`)
        }
        
        // Try to connect to the first found instance
        const firstInstance = instances[0]
        this.log(`\n🔄 Attempting to connect to Chrome on port ${firstInstance.port}...`)
        
        try {
          this.browser = await chromium.connectOverCDP(`http://${host}:${firstInstance.port}`)
          this.context = this.browser.contexts()[0]
          
          this.log(`✅ Connected to Chrome on port ${firstInstance.port}`)
          this.log(`💡 To use this port by default, add --port ${firstInstance.port}`)
          
          // Success! We connected to a different port
          return
        } catch (altConnectError: any) {
          this.log(`❌ Failed to connect to Chrome on port ${firstInstance.port}`)
        }
      }
      
      if (launch) {
        try {
          this.log('🚀 Launching new Chrome instance...')
          
          const launchOptions: any = {
            headless,
            args: [
              `--remote-debugging-port=${port}`,
              '--no-first-run',
              '--no-default-browser-check',
            ],
            channel: 'chrome',
          }
          
          // Add container-specific flags if needed
          if (process.env.DEVCONTAINER === 'true' || process.env.CHROME_FLAGS) {
            launchOptions.args.push('--no-sandbox', '--disable-dev-shm-usage')
          }
          
          // Add profile support
          if (profile) {
            const profilePath = this.getProfilePath(profile)
            this.log(`📁 Using Chrome profile: ${profilePath}`)
            launchOptions.args.push(`--user-data-dir=${profilePath}`)
          }
          
          this.browser = await chromium.launch(launchOptions)
          this.context = await this.browser.newContext()
          this.isLaunched = true
          
          this.log(`✅ Chrome launched successfully${profile ? ` with profile "${profile}"` : ''}`)
          this.logVerbose(`Chrome launched in ${Date.now() - startTime}ms`)
        } catch (launchError: any) {
          this.error(`Failed to launch Chrome: ${launchError.message}`)
        }
      } else {
        this.error(`Failed to connect to Chrome at ${host}:${port}. 

Possible solutions:
1. Use --launch flag to start a new Chrome instance
2. Use 'chromancer spawn' to start Chrome (avoids profile picker by default)
3. Use 'chromancer spawn --profile NAME' for a specific saved profile
4. Start Chrome manually with: chrome --remote-debugging-port=${port}`)
      }
    }

    if (this.browser && this.context) {
      // Get or create a page
      const pages = this.context.pages()
      this.page = pages[0] || await this.context.newPage()
      
      this.logVerbose('Page setup complete', { 
        totalPages: pages.length,
        newPageCreated: pages.length === 0
      })
      
      const totalTime = Date.now() - startTime
      this.logVerbose(`Total connection time: ${totalTime}ms`)
    }
  }

  async waitForLogin(url: string, readySelector?: string): Promise<void> {
    if (!this.page) {
      this.error('No page available')
    }

    this.log(`🔐 Navigating to ${url}...`)
    await this.page!.goto(url, { waitUntil: 'domcontentloaded' })
    
    const checkSelector = readySelector || 'body'
    
    this.log(`⏳ Waiting for you to log in...`)
    this.log(`   (Looking for element: ${checkSelector})`)
    this.log(`   Press Ctrl+C to cancel`)
    
    // Check if already logged in
    try {
      await this.page!.waitForSelector(checkSelector, { timeout: 1000 })
      this.log('✅ Already logged in!')
      return
    } catch {
      // Not logged in yet, continue waiting
    }
    
    // Wait for login with visual feedback
    let dots = 0
    const loadingInterval = setInterval(() => {
      process.stdout.write(`\r⏳ Waiting for login${'.'.repeat(dots % 4)}    `)
      dots++
    }, 500)
    
    try {
      // Wait for either the ready selector or a common logged-in indicator
      await this.page!.waitForSelector(checkSelector, { timeout: 300000 }) // 5 minute timeout
      
      clearInterval(loadingInterval)
      process.stdout.write('\r')
      this.log('✅ Login detected! Continuing...')
      
      // Give the page a moment to fully load after login
      await this.page!.waitForLoadState('networkidle')
    } catch (error: any) {
      clearInterval(loadingInterval)
      process.stdout.write('\r')
      if (error.name === 'TimeoutError') {
        this.error('Timeout waiting for login (5 minutes)')
      }
      throw error
    }
  }

  /**
   * Enhanced error handler
   */
  protected handleError(error: Error | string): never {
    const err = typeof error === 'string' ? new Error(error) : error
    
    // Display error with tips if not in JSON mode
    if (!this.jsonEnabled()) {
      displayErrorWithTip(err, this.constructor.name.toLowerCase())
    }
    
    // Call parent error method
    this.exit(1)
  }

  /**
   * Log error with tips but don't exit
   */
  protected logError(error: Error, command?: string): void {
    if (!this.jsonEnabled()) {
      displayErrorWithTip(error, command || this.constructor.name.toLowerCase())
    } else {
      this.logToStderr(error.message)
    }
  }

  async finally(): Promise<void> {
    if (!this.browser) return;

    // 1️⃣ We launched Chrome in this process -----------------------------
    if (this.isLaunched) {
      if (this.keepOpen) {
        this.log('🔓 Keeping Chrome open (use --no-keepOpen to close automatically)');
      } else {
        this.log('🔒 Closing Chrome (launched by this command)…');
        await this.browser.close();
      }
      return;
    }

    // 2️⃣ We only attached to an *external* Chrome -----------------------
    // Close the CDP *connection* so Node's event‑loop can exit, but
    // *do not* close the user's Chrome window.
    this.logVerbose('Disconnecting from existing Chrome…');
    await this.browser.close();
  }
}