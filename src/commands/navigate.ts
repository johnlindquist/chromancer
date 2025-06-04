import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base'

export default class Navigate extends BaseCommand {
  static description = 'Navigate to a URL in Chrome'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://example.com',
    '<%= config.bin %> <%= command.id %> https://example.com --wait-until networkidle0',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'wait-until': Flags.string({
      description: 'When to consider navigation succeeded',
      options: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
      default: 'load',
    }),
    timeout: Flags.integer({
      description: 'Maximum navigation time in milliseconds',
      default: 30000,
    }),
  }

  static args = {
    url: Args.string({
      description: 'URL to navigate to',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Navigate)
    
    await this.connectToChrome(flags.port, flags.host, flags.launch, flags.verbose, flags.keepOpen)
    
    if (!this.page) {
      this.error('No page available')
    }

    // Set up verbose logging event listeners
    if (flags.verbose) {
      this.setupVerbosePageListeners()
    }

    try {
      this.log(`Navigating to ${args.url}...`)
      this.logVerbose('Navigation options', {
        url: args.url,
        waitUntil: flags['wait-until'],
        timeout: flags.timeout
      })
      
      const startTime = Date.now()
      await this.page.goto(args.url, {
        waitUntil: flags['wait-until'] as any,
        timeout: flags.timeout,
      })
      
      const navigationTime = Date.now() - startTime
      this.log(`Successfully navigated to ${args.url}`)
      this.logVerbose(`Navigation completed in ${navigationTime}ms`)
      
      // Log final page metrics
      if (flags.verbose) {
        await this.logPageMetrics()
      }
    } catch (error: any) {
      this.logVerbose('Navigation failed', {
        error: error.message || error,
        stack: error.stack
      })
      
      // Try to get more context about the failure
      if (flags.verbose && this.page) {
        try {
          const currentURL = this.page.url()
          const title = await this.page.title().catch(() => 'N/A')
          this.logVerbose('Page state at failure', {
            currentURL,
            title,
            isClosed: this.page.isClosed()
          })
        } catch (contextError: any) {
          this.logVerbose('Could not get page context', { error: contextError.message })
        }
      }
      
      this.error(`Failed to navigate: ${error}`)
    } finally {
      // Clean up event listeners
      if (flags.verbose) {
        this.removeVerbosePageListeners()
      }
    }
  }

  private setupVerbosePageListeners(): void {
    if (!this.page) return

    // Track requests
    this.page.on('request', (request) => {
      this.logVerbose('Request initiated', {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        headers: request.headers()
      })
    })

    // Track responses
    this.page.on('response', (response) => {
      this.logVerbose('Response received', {
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers()
      })
    })

    // Track failed requests
    this.page.on('requestfailed', (request) => {
      this.logVerbose('Request failed', {
        url: request.url(),
        failure: request.failure(),
        resourceType: request.resourceType()
      })
    })

    // Track navigation events
    this.page.on('load', () => {
      this.logVerbose('Page load event fired')
    })

    this.page.on('domcontentloaded', () => {
      this.logVerbose('DOM content loaded event fired')
    })

    // Track console messages
    this.page.on('console', (msg) => {
      this.logVerbose('Console message', {
        type: msg.type(),
        text: msg.text()
      })
    })

    // Track page errors
    this.page.on('pageerror', (error) => {
      this.logVerbose('Page error', {
        message: error.message,
        stack: error.stack
      })
    })

    // Track frame navigation
    this.page.on('framenavigated', (frame) => {
      this.logVerbose('Frame navigated', {
        url: frame.url(),
        name: frame.name(),
        isMainFrame: frame === this.page?.mainFrame()
      })
    })
  }

  private removeVerbosePageListeners(): void {
    if (!this.page) return
    
    // Remove all listeners to prevent memory leaks
    this.page.removeAllListeners('request')
    this.page.removeAllListeners('response')
    this.page.removeAllListeners('requestfailed')
    this.page.removeAllListeners('load')
    this.page.removeAllListeners('domcontentloaded')
    this.page.removeAllListeners('console')
    this.page.removeAllListeners('pageerror')
    this.page.removeAllListeners('framenavigated')
  }

  private async logPageMetrics(): Promise<void> {
    if (!this.page) return

    try {
      // Get performance metrics
      const metrics = await this.page.metrics()
      this.logVerbose('Page metrics', metrics)

      // Get navigation timing
      const navigationTiming = await this.page.evaluate(() => {
        const timing = (performance as any).timing
        if (!timing) return null
        return {
          domainLookup: timing.domainLookupEnd - timing.domainLookupStart,
          connect: timing.connectEnd - timing.connectStart,
          request: timing.responseStart - timing.requestStart,
          response: timing.responseEnd - timing.responseStart,
          domInteractive: timing.domInteractive - timing.navigationStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart
        }
      })
      this.logVerbose('Navigation timing', navigationTiming)
    } catch (error: any) {
      this.logVerbose('Could not get page metrics', { error: error.message })
    }
  }
}