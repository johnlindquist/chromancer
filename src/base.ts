import { Command, Flags } from '@oclif/core'
import puppeteer, { Browser, Page } from 'puppeteer-core'
import { SessionManager } from './session.js'

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
  }

  protected browser?: Browser
  protected page?: Page
  private isLaunched = false

  async connectToChrome(port: number | undefined, host: string, launch: boolean = false): Promise<void> {
    // Check for active session first
    const session = await SessionManager.getValidSession()
    if (session && !port) {
      port = session.port
      this.log(`Using active session on port ${port}`)
    } else if (!port) {
      port = 9222 // Default port
    }
    
    try {
      // First try to connect to existing Chrome instance
      this.browser = await puppeteer.connect({
        browserURL: `http://${host}:${port}`,
        defaultViewport: null,
      });
      this.log('Connected to Chrome');
    } catch (connectError) {
      if (launch) {
        // Try to launch Chrome
        try {
          this.log('Launching Chrome...');
          this.browser = await puppeteer.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              `--remote-debugging-port=${port}`,
            ],
            executablePath: this.findChromeExecutable(),
          });
          this.isLaunched = true;
          this.log('Chrome launched successfully');
        } catch (launchError) {
          this.error(`Failed to connect to or launch Chrome: ${connectError}\nLaunch error: ${launchError}`);
        }
      } else {
        this.error(`Failed to connect to Chrome at ${host}:${port}. Make sure Chrome is running with --remote-debugging-port=${port} or use --launch flag`);
      }
    }

    if (this.browser) {
      const pages = await this.browser.pages();
      this.page = pages[0] || await this.browser.newPage();
    }
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

    const { execSync } = require('child_process');
    
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
    const fs = require('fs');
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
        await this.browser.close();
      } else {
        await this.browser.disconnect();
      }
    }
  }
}