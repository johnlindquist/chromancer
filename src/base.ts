import { Command, Flags } from '@oclif/core'
import puppeteer, { Browser, Page } from 'puppeteer-core'
import { SessionManager } from './session.js'
import fetch from 'node-fetch'

export abstract class BaseCommand extends Command {
  static baseFlags = {
    port: Flags.integer({
      char: 'p',
      description: 'Chrome debugging port (uses active session if available)',
      required: false,
    }),
    host: Flags.string({
      char: 'h',
      description: 'Chrome debugging host',
      default: 'localhost',
    }),
    launch: Flags.boolean({
      char: 'l',
      description: 'Launch Chrome automatically (requires Chrome/Chromium installed)',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Enable verbose logging for debugging',
      default: false,
    }),
    keepOpen: Flags.boolean({
      char: 'k',
      description: 'Keep Chrome open after command completes (when using --launch)',
      default: true,
      allowNo: true,
    }),
  }

  protected browser?: Browser
  protected page?: Page
  private isLaunched = false
  protected verbose = false
  private keepOpen = false
  private chromePid?: number

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

  async connectToChrome(port: number | undefined, host: string, launch: boolean = false, verbose: boolean = false, keepOpen: boolean = false): Promise<void> {
    this.verbose = verbose
    this.keepOpen = keepOpen
    const startTime = Date.now()
    
    this.logVerbose('Starting Chrome connection process', { port, host, launch })
    
    // Check for active session first
    const session = SessionManager.loadSession()
    if (session && !port) {
      // Verify the session is still valid by checking if Chrome is still running
      try {
        const testResponse = await fetch(`http://${host}:${session.port}/json/version`)
        if (testResponse.ok) {
          port = session.port
          this.log(`🔄 Found saved Chrome session on port ${port}`)
          this.logVerbose('Using saved session', session)
        } else {
          SessionManager.clearSession()
          this.logVerbose('Saved session no longer valid')
        }
      } catch (error) {
        SessionManager.clearSession()
        this.logVerbose('Saved session no longer valid')
      }
    }
    
    if (!port) {
      port = 9222 // Default port
      this.logVerbose('No port specified, using default port 9222')
    }
    
    const browserURL = `http://${host}:${port}`
    this.log(`🔍 Checking for existing Chrome instance at ${browserURL}...`)
    
    try {
      // First try to connect to existing Chrome instance
      const connectStart = Date.now()
      this.browser = await puppeteer.connect({
        browserURL: browserURL,
        defaultViewport: null,
      });
      const connectTime = Date.now() - connectStart
      
      this.log('✅ Connected to existing Chrome instance');
      this.logVerbose(`Connection successful in ${connectTime}ms`)
      
      // Get browser version and other details
      const version = await this.browser.version()
      this.logVerbose('Browser details', { version, browserURL })
    } catch (connectError: any) {
      this.log(`❌ No existing Chrome instance found at ${browserURL}`)
      this.logVerbose('Connection failed', { error: connectError.message || connectError })
      if (launch) {
        // Try to launch Chrome
        try {
          this.log('🚀 Launching new Chrome instance...');
          const executablePath = this.findChromeExecutable()
          this.logVerbose('Found Chrome executable', { executablePath })
          
          const launchStart = Date.now()
          // Use a temporary user data directory to ensure a separate Chrome instance
          const tmpDir = require('path').join(require('os').tmpdir(), 'chromancer-profile')
          if (!require('fs').existsSync(tmpDir)) {
            require('fs').mkdirSync(tmpDir, { recursive: true })
          }
          
          const launchOptions = {
            headless: false,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              `--remote-debugging-port=${port}`,
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              `--user-data-dir=${tmpDir}`,
              '--no-first-run',
              '--no-default-browser-check'
            ],
            executablePath: executablePath,
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false,
            detached: true
          }
          this.logVerbose('Launch options', launchOptions)
          
          this.browser = await puppeteer.launch(launchOptions);
          const launchTime = Date.now() - launchStart
          
          // Get the Chrome process PID
          const browserProcess = this.browser.process();
          if (browserProcess) {
            this.chromePid = browserProcess.pid;
            this.logVerbose(`Chrome process PID: ${this.chromePid}`);
          }
          
          this.isLaunched = true;
          this.log(`✅ Chrome launched successfully on port ${port}`);
          this.logVerbose(`Chrome launched in ${launchTime}ms`)
          
          // Get browser version after launch
          const version = await this.browser.version()
          this.logVerbose('Launched browser details', { version })
        } catch (launchError: any) {
          this.logVerbose('Launch failed', { error: launchError.message || launchError })
          this.error(`Failed to connect to or launch Chrome: ${connectError}\nLaunch error: ${launchError}`);
        }
      } else {
        this.error(`Failed to connect to Chrome at ${host}:${port}. 

Possible solutions:
1. Use --launch flag to start a new Chrome instance
2. Use 'chromancer spawn' to start a persistent Chrome instance
3. Start Chrome manually with: google-chrome --remote-debugging-port=${port}
4. If Chrome is already running, you may need to close it first`);
      }
    }

    if (this.browser) {
      const pages = await this.browser.pages();
      this.page = pages[0] || await this.browser.newPage();
      this.logVerbose('Page setup complete', { 
        totalPages: pages.length,
        newPageCreated: pages.length === 0
      })
      
      const totalTime = Date.now() - startTime
      this.logVerbose(`Total connection time: ${totalTime}ms`)
    }
  }

  private findChromeExecutable(): string | undefined {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const platform = process.platform;
    
    // Common Chrome/Chromium executable paths by platform
    const paths: string[] = [];
    
    if (platform === 'win32') {
      // Windows paths
      paths.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe'
      );
      
      // Try to find Chrome via where command on Windows
      try {
        const chromePath = execSync('where chrome.exe', { encoding: 'utf8' }).trim();
        if (chromePath) {
          return chromePath.split('\n')[0];
        }
      } catch {
        // Try another method
      }
      
      // Try to find Chrome via registry
      try {
        const regPath = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /v Path', { encoding: 'utf8' });
        const match = regPath.match(/REG_SZ\s+(.+)/i);
        if (match && match[1]) {
          const chromePath = match[1].trim() + '\\chrome.exe';
          if (fs.existsSync(chromePath)) {
            return chromePath;
          }
        }
      } catch {
        // Registry query failed, continue
      }
    } else if (platform === 'darwin') {
      // macOS paths
      paths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
      );
    } else {
      // Linux paths
      paths.push(
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/local/bin/chrome',
        '/snap/bin/chromium'
      );
      
      // Try to find Chrome via 'which' command on Unix-like systems
      try {
        const chromePath = execSync('which chromium || which chromium-browser || which google-chrome || which chrome', { encoding: 'utf8' }).trim();
        if (chromePath) {
          return chromePath.split('\n')[0]; // Return first found
        }
      } catch {
        // Continue to check predefined paths
      }
    }

    // Check predefined paths
    for (const path of paths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }

    return undefined;
  }

  async finally(): Promise<void> {
    if (this.browser) {
      if (this.isLaunched) {
        if (this.keepOpen) {
          // Save session info before disconnecting
          const wsEndpoint = this.browser.wsEndpoint();
          const port = wsEndpoint.match(/:(\d+)/)?.[1];
          
          this.log('🔓 Keeping Chrome open (use --no-keepOpen to close automatically)');
          this.log('⚠️  Note: Chrome may close when this process exits. Use "chromancer spawn" for persistent Chrome.');
          // Just disconnect, don't close the browser
          await this.browser.disconnect();
          
          if (port && this.chromePid) {
            SessionManager.saveSession({
              port: parseInt(port),
              pid: this.chromePid,
              startTime: Date.now()
            });
            this.log(`💾 Session saved on port ${port} (PID: ${this.chromePid})`);
          } else if (port) {
            this.log(`⚠️ Could not save session - Chrome PID not available`);
          }
          
          // Force process exit since we're keeping Chrome open
          // Node would otherwise wait for the Chrome process
          process.exit(0);
        } else {
          this.log('🔒 Closing Chrome...');
          await this.browser.close();
        }
      } else {
        await this.browser.disconnect();
      }
    }
  }
}