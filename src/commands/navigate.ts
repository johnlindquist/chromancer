import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'

export default class Navigate extends BaseCommand {
  static description = 'Navigate to a URL in Chrome'

  static examples = [
    '<%= config.bin %> <%= command.id %> example.com',
    '<%= config.bin %> <%= command.id %> google.com',
    '<%= config.bin %> <%= command.id %> https://example.com --wait-until networkidle',
    '<%= config.bin %> <%= command.id %> github.com --profile work',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'wait-until': Flags.string({
      description: 'When to consider navigation succeeded',
      options: ['load', 'domcontentloaded', 'networkidle', 'commit'],
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
    
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      flags.keepOpen
    )
    
    if (!this.page) {
      this.error('No page available')
    }

    // Set up verbose logging event listeners
    if (flags.verbose) {
      this.setupVerbosePageListeners()
    }

    // Normalize URL - add protocol if missing
    let normalizedUrl = args.url
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      // Check if it looks like a local file path
      if (normalizedUrl.startsWith('/') || normalizedUrl.startsWith('./') || normalizedUrl.match(/^[A-Za-z]:\\/)) {
        normalizedUrl = `file://${normalizedUrl}`
      } else {
        // Assume it's a domain name
        normalizedUrl = `https://${normalizedUrl}`
      }
      this.logVerbose(`Normalized URL from "${args.url}" to "${normalizedUrl}"`)
    }

    try {
      this.log(`🌐 Navigating to ${normalizedUrl}...`)
      this.logVerbose('Navigation options', {
        url: normalizedUrl,
        waitUntil: flags['wait-until'],
        timeout: flags.timeout,
      })

      const startTime = Date.now()
      const response = await this.page!.goto(normalizedUrl, {
        waitUntil: flags['wait-until'] as any,
        timeout: flags.timeout,
      })

      const loadTime = Date.now() - startTime
      
      if (response) {
        const status = response.status()
        this.log(`✅ Navigated to ${normalizedUrl} (${status} - ${loadTime}ms)`)
        
        if (flags.verbose) {
          const metrics = await this.page!.evaluate(() => {
            const timing = performance.timing
            return {
              domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
              loadComplete: timing.loadEventEnd - timing.loadEventStart,
              domInteractive: timing.domInteractive - timing.navigationStart,
              responseEnd: timing.responseEnd - timing.requestStart,
            }
          })
          
          this.logVerbose('Performance metrics', metrics)
        }
      } else {
        this.log(`✅ Navigated to ${normalizedUrl} (${loadTime}ms)`)
      }

      // Get final page info
      const title = await this.page!.title()
      const finalUrl = this.page!.url()
      
      if (title) {
        this.log(`📄 Page title: "${title}"`)
      }
      
      if (finalUrl !== normalizedUrl && finalUrl !== args.url) {
        this.log(`🔀 Final URL: ${finalUrl}`)
      }
    } catch (error: any) {
      if (error.name === 'TimeoutError') {
        this.error(`Navigation timeout: Failed to navigate to ${normalizedUrl} within ${flags.timeout}ms`)
      }
      this.error(`Navigation failed: ${error.message}`)
    }
  }

  private setupVerbosePageListeners(): void {
    if (!this.page) return

    // Request logging
    this.page.on('request', request => {
      this.logVerbose(`📤 Request: ${request.method()} ${request.url()}`)
    })

    // Response logging
    this.page.on('response', response => {
      this.logVerbose(`📥 Response: ${response.status()} ${response.url()}`)
    })

    // Console logging
    this.page.on('console', msg => {
      this.logVerbose(`🖥️  Console [${msg.type()}]: ${msg.text()}`)
    })

    // Page errors
    this.page.on('pageerror', error => {
      this.logVerbose(`❌ Page error: ${error.message}`)
    })

    // Frame navigation
    this.page.on('framenavigated', frame => {
      if (frame === this.page!.mainFrame()) {
        this.logVerbose(`🔄 Main frame navigated to: ${frame.url()}`)
      }
    })

    // Downloads
    this.page.on('download', download => {
      this.logVerbose(`⬇️  Download started: ${download.suggestedFilename()}`)
    })
  }
}