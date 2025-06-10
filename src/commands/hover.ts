import {Args, Flags} from '@oclif/core'
import {Page} from 'puppeteer-core'
import {BaseCommand} from '../base.js'

export default class Hover extends BaseCommand {
  static description = 'Hover over an element to trigger hover states and tooltips'

  static examples = [
    '<%= config.bin %> <%= command.id %> "#menu-item"',
    '<%= config.bin %> <%= command.id %> ".dropdown-toggle" --duration 2000',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    duration: Flags.integer({
      char: 'd',
      description: 'Duration to keep hovering in milliseconds',
      default: 0,
    }),
  }

  static args = {
    selector: Args.string({
      required: true,
      description: 'CSS selector of element to hover over',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Hover)
    
    await this.connectToChrome(flags.port, flags.host, flags.launch, flags.verbose, flags.keepOpen)
    
    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    await this.executeCommand(this.page, args.selector, flags.duration)
  }

  private async executeCommand(page: Page, selector: string, duration: number): Promise<void> {
    try {
      this.logVerbose(`Looking for element: ${selector}`)
      
      // Wait for element to be present
      const element = await page.waitForSelector(selector, {
        timeout: 5000,
      })
      
      if (!element) {
        this.error(`Element not found: ${selector}`)
      }
      
      // Move mouse to element
      await element.hover()
      
      this.log(`Hovered over element: ${selector}`)
      
      // If duration specified, keep hovering
      if (duration > 0) {
        this.logVerbose(`Keeping hover for ${duration}ms`)
        await new Promise(resolve => setTimeout(resolve, duration))
      }
      
    } catch (error: any) {
      if (error.name === 'TimeoutError') {
        this.error(`Element not found: ${selector}`)
      }
      this.error(`Failed to hover: ${error.message}`)
    }
  }
}