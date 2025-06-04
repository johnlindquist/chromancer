import { Args, Command, Flags } from '@oclif/core'
import { spawn } from 'child_process'
import * as net from 'net'
import * as fs from 'fs'
import { execSync } from 'child_process'

export default class Spawn extends Command {
  static description = 'Spawn a Chrome browser instance with remote debugging'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://example.com',
    '<%= config.bin %> <%= command.id %> https://example.com --port 9223',
    '<%= config.bin %> <%= command.id %> https://example.com --headless',
  ]

  static flags = {
    port: Flags.integer({
      char: 'p',
      description: 'Remote debugging port (default: 9222, fallback: 9223-9232)',
      default: 9222,
    }),
    headless: Flags.boolean({
      description: 'Run Chrome in headless mode',
      default: false,
    }),
    'user-data-dir': Flags.string({
      description: 'Chrome user data directory',
    }),
  }

  static args = {
    url: Args.string({
      description: 'URL to open in Chrome',
      required: false,
      default: 'about:blank',
    }),
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer()
      
      server.once('error', () => {
        resolve(false)
      })
      
      server.once('listening', () => {
        server.close()
        resolve(true)
      })
      
      server.listen(port)
    })
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const maxPort = startPort + 10
    
    for (let port = startPort; port <= maxPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port
      }
    }
    
    throw new Error(`No available ports found between ${startPort} and ${maxPort}`)
  }

  private findChromeExecutable(): string | undefined {
    // Common Chrome/Chromium executable paths
    const paths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/local/bin/chrome',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    
    // Try to find Chrome via 'which' command
    try {
      const chromePath = execSync('which chromium || which chromium-browser || which google-chrome || which chrome', { encoding: 'utf8' }).trim();
      if (chromePath) {
        return chromePath.split('\n')[0]; // Return first found
      }
    } catch {
      // Continue to check predefined paths
    }

    // Check predefined paths
    for (const path of paths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }

    return undefined;
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Spawn)
    
    // Find an available port
    let port = flags.port
    if (!await this.isPortAvailable(port)) {
      this.log(`Port ${port} is not available, searching for an alternative...`)
      port = await this.findAvailablePort(port + 1)
      this.log(`Using port ${port}`)
    }

    // Find Chrome executable
    const chromePath = this.findChromeExecutable()
    if (!chromePath) {
      this.error('Chrome executable not found. Please install Chrome or Chromium.')
    }

    // Build Chrome arguments
    const chromeArgs = [
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--no-default-browser-check',
    ]

    if (flags.headless) {
      chromeArgs.push('--headless=new')
    }

    if (flags['user-data-dir']) {
      chromeArgs.push(`--user-data-dir=${flags['user-data-dir']}`)
    }

    if (args.url && args.url !== 'about:blank') {
      chromeArgs.push(args.url)
    }

    // Spawn Chrome
    this.log(`Spawning Chrome on port ${port}...`)
    const chromeProcess = spawn(chromePath, chromeArgs, {
      detached: true,
      stdio: 'ignore',
    })

    chromeProcess.unref()

    // Wait a moment for Chrome to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verify Chrome is running
    try {
      const response = await fetch(`http://localhost:${port}/json/version`)
      const version = await response.json() as { Browser: string }
      
      this.log(`✅ Chrome spawned successfully on port ${port}`)
      this.log(`Browser: ${version.Browser}`)
      this.log(`DevTools URL: http://localhost:${port}`)
      
      if (args.url && args.url !== 'about:blank') {
        this.log(`Opened: ${args.url}`)
      }
    } catch (error) {
      this.warn('Chrome process started but DevTools connection could not be verified')
      this.log(`Try connecting manually to http://localhost:${port}`)
    }
  }
}