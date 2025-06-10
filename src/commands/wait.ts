import {Flags} from '@oclif/core'
import {Page} from 'puppeteer-core'
import {BaseCommand} from '../base.js'

export default class Wait extends BaseCommand {
  static description = 'Wait for elements or conditions before proceeding'

  static examples = [
    '<%= config.bin %> <%= command.id %> --selector "#dynamic-content"',
    '<%= config.bin %> <%= command.id %> --selector ".loading" --hidden',
    '<%= config.bin %> <%= command.id %> --condition "document.readyState === \'complete\'"',
    '<%= config.bin %> <%= command.id %> --page-load',
    '<%= config.bin %> <%= command.id %> --network-idle',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    selector: Flags.string({
      char: 's',
      description: 'CSS selector to wait for',
    }),
    condition: Flags.string({
      char: 'c',
      description: 'JavaScript condition to wait for',
    }),
    visible: Flags.boolean({
      description: 'Wait for element to be visible',
      default: false,
    }),
    hidden: Flags.boolean({
      description: 'Wait for element to be hidden',
      default: false,
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Maximum time to wait in milliseconds',
      default: 30000,
    }),
    'page-load': Flags.boolean({
      description: 'Wait for page load to complete',
      default: false,
    }),
    'network-idle': Flags.boolean({
      description: 'Wait for network to be idle',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Wait)
    
    await this.connectToChrome(flags.port, flags.host, flags.launch, flags.verbose, flags.keepOpen)
    
    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    await this.executeCommand(this.page)
  }

  private async executeCommand(page: Page): Promise<void> {
    const {flags} = await this.parse(Wait)
    
    const waitPromises: Promise<any>[] = []
    const waitDescriptions: string[] = []

    // Wait for selector
    if (flags.selector) {
      if (flags.visible) {
        waitPromises.push(page.waitForSelector(flags.selector, {
          visible: true,
          timeout: flags.timeout,
        }))
        waitDescriptions.push(`element "${flags.selector}" to be visible`)
      } else if (flags.hidden) {
        waitPromises.push(page.waitForSelector(flags.selector, {
          hidden: true,
          timeout: flags.timeout,
        }))
        waitDescriptions.push(`element "${flags.selector}" to be hidden`)
      } else {
        waitPromises.push(page.waitForSelector(flags.selector, {
          timeout: flags.timeout,
        }))
        waitDescriptions.push(`element "${flags.selector}"`)
      }
    }

    // Wait for custom condition
    if (flags.condition) {
      waitPromises.push(page.waitForFunction(flags.condition, {
        timeout: flags.timeout,
      }))
      waitDescriptions.push(`condition "${flags.condition}"`)
    }

    // Wait for page load
    if (flags['page-load']) {
      waitPromises.push(page.waitForNavigation({
        waitUntil: 'load',
        timeout: flags.timeout,
      }).catch(() => {
        // If no navigation happens, check if page is already loaded
        return page.evaluate('document.readyState === "complete"')
      }))
      waitDescriptions.push('page load')
    }

    // Wait for network idle
    if (flags['network-idle']) {
      waitPromises.push(page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: flags.timeout,
      }).catch(() => {
        // If no navigation happens, assume network is already idle
        return Promise.resolve()
      }))
      waitDescriptions.push('network idle')
    }

    // If no wait conditions specified, show error
    if (waitPromises.length === 0) {
      this.error('No wait condition specified. Use --selector, --condition, --page-load, or --network-idle')
    }

    try {
      // Wait for all conditions
      await Promise.all(waitPromises)
      
      if (waitDescriptions.length === 1) {
        if (flags.selector && flags.visible) {
          this.log(`Element is visible: ${flags.selector}`)
        } else if (flags.selector && flags.hidden) {
          this.log(`Element is hidden: ${flags.selector}`)
        } else if (flags.selector) {
          this.log(`Element found: ${flags.selector}`)
        } else if (flags.condition) {
          this.log(`Condition met: ${flags.condition}`)
        } else if (flags['page-load']) {
          this.log('Page loaded')
        } else if (flags['network-idle']) {
          this.log('Network idle')
        }
      } else {
        this.log(`All conditions met: ${waitDescriptions.join(', ')}`)
      }
    } catch (error: any) {
      if (error.name === 'TimeoutError') {
        this.error(`Timeout waiting for ${waitDescriptions.join(', ')}`)
      }
      throw error
    }
  }
}