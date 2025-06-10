import {Flags} from '@oclif/core'
import {Page} from 'puppeteer-core'
import {BaseCommand} from '../base.js'

export default class Store extends BaseCommand {
  static description = 'Store values from page elements or evaluations for later use'

  static examples = [
    '<%= config.bin %> <%= command.id %> --selector "#price" --as "originalPrice"',
    '<%= config.bin %> <%= command.id %> --eval "document.title" --as "pageTitle"',
    '<%= config.bin %> <%= command.id %> --selector "#username" --as "username" --property "value"',
    '<%= config.bin %> <%= command.id %> --list',
    '<%= config.bin %> <%= command.id %> --clear',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    selector: Flags.string({
      char: 's',
      description: 'CSS selector of element to store value from',
      exclusive: ['eval', 'list', 'clear'],
    }),
    eval: Flags.string({
      char: 'e',
      description: 'JavaScript expression to evaluate and store',
      exclusive: ['selector', 'list', 'clear'],
    }),
    as: Flags.string({
      char: 'a',
      description: 'Variable name to store the value as',
      dependsOn: ['selector', 'eval'],
    }),
    property: Flags.string({
      char: 'p',
      description: 'Element property to store (default: textContent)',
      default: 'textContent',
      dependsOn: ['selector'],
    }),
    attribute: Flags.string({
      description: 'Element attribute to store',
      exclusive: ['property'],
      dependsOn: ['selector'],
    }),
    list: Flags.boolean({
      description: 'List all stored values',
      exclusive: ['selector', 'eval', 'clear'],
    }),
    clear: Flags.boolean({
      description: 'Clear all stored values',
      exclusive: ['selector', 'eval', 'list'],
    }),
  }

  // Static storage that persists across command invocations
  private static storage: Record<string, any> = {}

  async run(): Promise<void> {
    const {flags} = await this.parse(Store)
    
    // Handle list and clear operations without Chrome connection
    if (flags.list) {
      this.listStoredValues()
      return
    }
    
    if (flags.clear) {
      this.clearStoredValues()
      return
    }
    
    // For other operations, connect to Chrome
    await this.connectToChrome(flags.port, flags.host, flags.launch, flags.verbose, flags.keepOpen)
    
    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    await this.executeCommand(this.page, flags)
  }

  private async executeCommand(page: Page, flags: any): Promise<void> {
    // Ensure chromancer namespace exists in the page
    await page.evaluate(`
      if (typeof window.chromancer === 'undefined') {
        window.chromancer = { stored: {} };
      } else if (typeof window.chromancer.stored === 'undefined') {
        window.chromancer.stored = {};
      }
    `)
    
    // Inject existing stored values into the page
    for (const [key, value] of Object.entries(Store.storage)) {
      await page.evaluate(`
        window.chromancer.stored["${key}"] = ${JSON.stringify(value)};
      `)
    }
    
    let value: any
    
    if (flags.selector) {
      // Store from element
      try {
        const element = await page.waitForSelector(flags.selector, {
          timeout: 5000,
        })
        
        if (!element) {
          this.error(`Element not found: ${flags.selector}`)
        }
        
        if (flags.attribute) {
          // Get attribute value
          value = await page.evaluate((el, attr) => {
            return el.getAttribute(attr)
          }, element, flags.attribute)
        } else {
          // Get property value
          value = await page.evaluate((el, prop) => {
            return (el as any)[prop]
          }, element, flags.property)
        }
        
      } catch (error: any) {
        if (error.name === 'TimeoutError') {
          this.error(`Element not found: ${flags.selector}`)
        }
        throw error
      }
    } else if (flags.eval) {
      // Store from evaluation
      try {
        value = await page.evaluate(flags.eval)
      } catch (error: any) {
        this.error(`Failed to evaluate expression: ${error.message}`)
      }
    }
    
    if (!flags.as) {
      this.error('Variable name required. Use --as flag to specify a name')
    }
    
    // Store the value
    Store.storage[flags.as] = value
    
    // Also store in the page context
    await page.evaluate(`
      window.chromancer.stored["${flags.as}"] = ${JSON.stringify(value)};
    `)
    
    this.log(`Stored value as "${flags.as}": ${JSON.stringify(value)}`)
  }
  
  private listStoredValues(): void {
    if (Object.keys(Store.storage).length === 0) {
      this.log('No values stored')
      return
    }
    
    this.log('Stored values:')
    for (const [key, value] of Object.entries(Store.storage)) {
      this.log(`  ${key}: ${JSON.stringify(value)}`)
    }
  }
  
  private clearStoredValues(): void {
    const count = Object.keys(Store.storage).length
    Store.storage = {}
    this.log(`Cleared all stored values (${count} values removed)`)
  }
}