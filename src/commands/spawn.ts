import { Args, Command, Flags } from '@oclif/core'
import * as net from 'net'
import * as path from 'path'
import * as os from 'os'
import { spawn, execSync } from 'child_process'
import { SessionManager } from '../session.js'
import { scanForChromeInstances, waitForChromeReady, findAvailablePort } from '../utils/chrome-scanner.js'

export default class Spawn extends Command {
  static description = 'Launch Chrome with remote debugging enabled using Playwright for reliable automation - supports auto-launch, profiles, and headless mode'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --no-profile  # Skip profile picker',
    '<%= config.bin %> <%= command.id %> --profile work  # Use specific profile',
    '<%= config.bin %> <%= command.id %> --port 9223  # Use different port',
    '<%= config.bin %> <%= command.id %> --headless  # Headless mode',
    '<%= config.bin %> <%= command.id %> https://example.com  # Open specific URL',
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
    'no-profile': Flags.boolean({
      description: 'Launch Chrome without any profile (incognito-like)',
      default: false,
    }),
    'wait-for-ready': Flags.boolean({
      description: 'Wait for Chrome to be fully ready before returning',
      default: true,
      allowNo: true,
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
      // First, scan for any existing Chrome instances
      const existingInstances = await scanForChromeInstances()
      if (existingInstances.length > 0) {
        this.log(`🔍 Found existing Chrome instance(s):`)
        for (const instance of existingInstances) {
          this.log(`   Port ${instance.port}: ${instance.version?.Browser || 'Chrome'}`)
        }
        
        // Check if our target port is already in use
        if (existingInstances.some(i => i.port === flags.port)) {
          this.log(`\n⚠️  Chrome is already running on port ${flags.port}`)
          this.log(`💡 Use 'chromancer stop' to close it first, or use a different port with --port`)
          return
        }
      }
      
      this.log(`🚀 Launching Chrome with remote debugging on port ${flags.port}...`)
      
      // Find Chrome executable
      const chromeExecutable = this.findChromeExecutable()
      if (!chromeExecutable) {
        this.error('Chrome executable not found. Please install Chrome or Chromium.')
      }
      
      this.log(`📍 Found Chrome at: ${chromeExecutable}`)
      
      // Build Chrome args
      const chromeArgs = [
        `--remote-debugging-port=${flags.port}`,
        '--no-first-run',
        '--no-default-browser-check',
      ]
      
      if (flags.headless) {
        chromeArgs.push('--headless')
      }
      
      if (flags.profile && !flags['no-profile']) {
        const profilePath = this.getProfilePath(flags.profile)
        this.log(`📁 Using Chrome profile: ${profilePath}`)
        chromeArgs.push(`--user-data-dir=${profilePath}`)
      } else if (flags['no-profile']) {
        // Launch with a temporary profile to avoid profile picker
        const tempDir = path.join(os.tmpdir(), `chromancer-temp-${Date.now()}`)
        chromeArgs.push(`--user-data-dir=${tempDir}`)
        this.log(`🔒 Using temporary profile (no saved data)`)
      } else {
        // Default Chrome profile - this might show profile picker
        this.log(`⚠️  Using default Chrome profile (may show profile picker)`)
        this.log(`💡 Use --no-profile to skip profile picker`)
      }
      
      // Add the URL if provided
      if (args.url && args.url !== 'about:blank') {
        chromeArgs.push(args.url)
      }
      
      // Launch Chrome detached
      const spawnOptions: any = {
        detached: true,
        stdio: 'ignore',
      }
      
      // On Windows, we need to use shell to properly detach
      if (process.platform === 'win32') {
        spawnOptions.shell = true
      }
      
      const chromeProcess = spawn(chromeExecutable, chromeArgs, spawnOptions)
      
      // Allow the parent process to exit
      chromeProcess.unref()
      
      // Save session info
      SessionManager.saveSession({
        port: flags.port,
        pid: chromeProcess.pid!,
        startTime: Date.now(),
        url: args.url,
      })
      
      // Wait for Chrome to be ready if requested
      let chromeStarted = false
      
      if (flags['wait-for-ready']) {
        this.log(`⏳ Waiting for Chrome to be ready...`)
        chromeStarted = await waitForChromeReady(flags.port, 'localhost', 10, 1000)
        
        if (!chromeStarted) {
          // Try scanning for Chrome on other ports in case profile picker changed the port
          this.log(`🔍 Scanning for Chrome instances...`)
          const instances = await scanForChromeInstances()
          
          if (instances.length > 0) {
            this.log(`\n⚠️  Chrome may have started on a different port:`)
            for (const instance of instances) {
              this.log(`   Port ${instance.port}: ${instance.version?.Browser || 'Chrome'}`)
            }
            this.log(`\n💡 Try connecting with: chromancer navigate example.com --port ${instances[0].port}`)
            return
          }
        }
      } else {
        // Don't wait, just return immediately
        this.log(`🚀 Chrome launching in background (not waiting for ready state)`)
      }
      
      if (chromeStarted) {
        this.log(`✅ Chrome launched successfully!`)
        this.log(`🔗 Remote debugging URL: http://localhost:${flags.port}`)
        
        if (flags.profile) {
          this.log(`📁 Profile: ${flags.profile}`)
        }
        
        this.log(`\n💡 Chrome is running in the background. Use these commands:`)
        this.log(`   chromancer navigate example.com`)
        this.log(`   chromancer click "#button"`)
        this.log(`   chromancer stop  # To close Chrome`)
      } else {
        // Even if we can't verify, Chrome might still be starting up
        this.log(`⚠️  Chrome launched but could not verify connection on port ${flags.port}`)
        this.log(`   Chrome may still be starting up. Try these commands in a moment:`)
        this.log(`   chromancer navigate example.com`)
        this.log(`   chromancer stop  # To close Chrome`)
      }
    } catch (error: any) {
      this.error(`Failed to spawn Chrome: ${error.message}`)
    }
  }
  
  private async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer()
      server.once('error', () => resolve(true))
      server.once('listening', () => {
        server.close()
        resolve(false)
      })
      server.listen(port)
    })
  }
  
  private findChromeExecutable(): string | null {
    const platform = process.platform
    
    // Common Chrome executable names
    const executables = [
      'google-chrome',
      'google-chrome-stable',
      'google-chrome-beta',
      'google-chrome-dev',
      'chromium',
      'chromium-browser',
      'chrome',
    ]
    
    try {
      if (platform === 'darwin') {
        // macOS paths
        const paths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
          '/usr/bin/chromium-browser',
          '/usr/bin/google-chrome',
        ]
        
        for (const chromePath of paths) {
          try {
            execSync(`test -f "${chromePath}"`, { stdio: 'ignore' })
            return chromePath
          } catch {
            // Continue checking
          }
        }
      } else if (platform === 'win32') {
        // Windows paths
        const paths = [
          process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
          process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
          process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
          process.env.LOCALAPPDATA + '\\Chromium\\Application\\chrome.exe',
        ]
        
        for (const chromePath of paths) {
          try {
            execSync(`if exist "${chromePath}" exit 0`, { stdio: 'ignore', shell: 'cmd.exe' })
            return chromePath
          } catch {
            // Continue checking
          }
        }
      } else {
        // Linux - try which command
        for (const exe of executables) {
          try {
            const result = execSync(`which ${exe} 2>/dev/null`, { encoding: 'utf8' }).trim()
            if (result) {
              return result
            }
          } catch {
            // Continue checking
          }
        }
      }
    } catch (error) {
      // Ignore errors and return null
    }
    
    return null
  }
}