import { Args, Command, Flags } from '@oclif/core'
import { chromium } from 'playwright'
import * as net from 'net'
import * as path from 'path'
import * as os from 'os'
import { SessionManager } from '../session.js'

export default class Spawn extends Command {
  static description = 'Spawn a Chrome browser instance with remote debugging'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://example.com',
    '<%= config.bin %> <%= command.id %> https://example.com --port 9223',
    '<%= config.bin %> <%= command.id %> https://example.com --headless',
    '<%= config.bin %> <%= command.id %> --profile work  # Opens with work profile',
    '<%= config.bin %> <%= command.id %> --headless  # Opens about:blank in headless mode',
  ]

  static flags = {
    port: Flags.integer({
      char: 'p',
      description: 'Remote debugging port',
      default: 9222,
    }),
    headless: Flags.boolean({
      description: 'Run Chrome in headless mode',
      default: false,
    }),
    profile: Flags.string({
      description: 'Chrome profile name or path to use',
    }),
  }

  static args = {
    url: Args.string({
      description: 'URL to open in Chrome',
      required: false,
      default: 'about:blank',
    }),
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

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Spawn)
    
    try {
      this.log(`🚀 Launching Chrome with remote debugging on port ${flags.port}...`)
      
      const launchOptions: any = {
        headless: flags.headless,
        args: [
          `--remote-debugging-port=${flags.port}`,
          '--no-first-run',
          '--no-default-browser-check',
        ],
        channel: 'chrome',
        // Keep browser running after script ends
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      }
      
      // Add profile support
      if (flags.profile) {
        const profilePath = this.getProfilePath(flags.profile)
        this.log(`📁 Using Chrome profile: ${profilePath}`)
        launchOptions.args.push(`--user-data-dir=${profilePath}`)
      }
      
      const browser = await chromium.launch(launchOptions)
      const context = browser.contexts()[0] || await browser.newContext()
      const page = context.pages()[0] || await context.newPage()
      
      // Navigate to the specified URL
      if (args.url && args.url !== 'about:blank') {
        await page.goto(args.url)
      }
      
      // Playwright doesn't expose wsEndpoint directly, but we can use the port
      const wsEndpoint = `ws://localhost:${flags.port}`
      
      this.log(`✅ Chrome launched successfully!`)
      this.log(`🔗 Remote debugging URL: http://localhost:${flags.port}`)
      this.log(`🔌 WebSocket endpoint: ${wsEndpoint}`)
      
      if (flags.profile) {
        this.log(`📁 Profile: ${flags.profile}`)
      }
      
      this.log(`\n💡 To connect from another terminal:`)
      this.log(`   chromancer navigate https://example.com --port ${flags.port}`)
      this.log(`   chromancer click "#button" --port ${flags.port}`)
      
      this.log(`\n⌛ Chrome will stay open. Press Ctrl+C to close.`)
      
      // Keep the process alive
      process.on('SIGINT', async () => {
        this.log('\n🔒 Closing Chrome...')
        await browser.close()
        process.exit(0)
      })
      
      // Prevent the process from exiting
      await new Promise(() => {})
    } catch (error: any) {
      this.error(`Failed to spawn Chrome: ${error.message}`)
    }
  }
}