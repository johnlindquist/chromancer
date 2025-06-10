import { Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'
import { waitForElement } from '../utils/selectors.js'
import { safeEvaluate } from '../utils/evaluation.js'

export default class Store extends BaseCommand {
  static description = 'Store values from page elements or evaluations for later use'

  static examples = [
    '<%= config.bin %> <%= command.id %> --selector "#price" --as "originalPrice"',
    '<%= config.bin %> <%= command.id %> --eval "document.title" --as "pageTitle"',
    '<%= config.bin %> <%= command.id %> --selector "#username" --as "username" --property "value"',
    '<%= config.bin %> <%= command.id %> --cookies --as "sessionCookies"',
    '<%= config.bin %> <%= command.id %> --list',
    '<%= config.bin %> <%= command.id %> --clear',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    selector: Flags.string({
      char: 's',
      description: 'CSS selector of element to store value from',
      exclusive: ['eval', 'list', 'clear', 'cookies'],
    }),
    eval: Flags.string({
      char: 'e',
      description: 'JavaScript expression to evaluate and store',
      exclusive: ['selector', 'list', 'clear', 'cookies'],
    }),
    cookies: Flags.boolean({
      description: 'Store all cookies',
      exclusive: ['selector', 'eval', 'list', 'clear'],
    }),
    as: Flags.string({
      char: 'a',
      description: 'Variable name to store the value as',
      dependsOn: ['selector', 'eval', 'cookies'],
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
      exclusive: ['selector', 'eval', 'clear', 'cookies'],
    }),
    clear: Flags.boolean({
      description: 'Clear all stored values',
      exclusive: ['selector', 'eval', 'list', 'cookies'],
    }),
    json: Flags.boolean({
      description: 'Output stored values as JSON',
      dependsOn: ['list'],
    }),
  }

  // Static storage that persists across command invocations
  private static storage: Record<string, any> = {}

  async run(): Promise<void> {
    const { flags } = await this.parse(Store)
    
    // Handle list and clear operations without Chrome connection
    if (flags.list) {
      this.listStoredValues(flags.json)
      return
    }
    
    if (flags.clear) {
      this.clearStoredValues()
      return
    }
    
    // For other operations, connect to Chrome
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
      this.error('Failed to connect to Chrome')
    }

    await this.executeCommand(this.page!, flags)
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
        this.log(`🔍 Looking for element: ${flags.selector}`)
        const element = await waitForElement(page, flags.selector, {
          timeout: 5000,
          state: 'attached'
        })
        
        if (flags.attribute) {
          // Get attribute value
          value = await element.getAttribute(flags.attribute)
          this.logVerbose(`Getting attribute "${flags.attribute}"`)
        } else {
          // Get property value
          value = await element.evaluate((el, prop) => {
            return (el as any)[prop]
          }, flags.property)
          this.logVerbose(`Getting property "${flags.property}"`)
        }
        
      } catch (error: any) {
        if (error.name === 'TimeoutError') {
          this.error(`Element not found: ${flags.selector}`)
        }
        throw error
      }
    } else if (flags.eval) {
      // Store from evaluation
      this.log(`🔧 Evaluating expression...`)
      value = await safeEvaluate(page, flags.eval)
    } else if (flags.cookies) {
      // Store cookies
      this.log(`🍪 Getting cookies...`)
      value = await page.context().cookies()
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
    
    this.log(`✅ Stored value as "${flags.as}": ${this.formatValue(value)}`)
    
    // Log storage info if verbose
    if (flags.verbose) {
      this.logVerbose('Storage info', {
        variable: flags.as,
        type: typeof value,
        isArray: Array.isArray(value),
        totalStored: Object.keys(Store.storage).length,
      })
    }
  }
  
  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return value.length > 100 ? `"${value.substring(0, 100)}..."` : `"${value}"`
    }
    if (typeof value === 'object') {
      const str = JSON.stringify(value)
      return str.length > 100 ? str.substring(0, 100) + '...' : str
    }
    return String(value)
  }
  
  private listStoredValues(json: boolean = false): void {
    if (Object.keys(Store.storage).length === 0) {
      this.log('❌ No values stored')
      return
    }
    
    if (json) {
      // Output as JSON for scripting
      console.log(JSON.stringify(Store.storage, null, 2))
    } else {
      this.log('📦 Stored values:')
      for (const [key, value] of Object.entries(Store.storage)) {
        this.log(`  ${key}: ${this.formatValue(value)}`)
      }
      this.log(`\n📊 Total: ${Object.keys(Store.storage).length} value(s)`)
    }
  }
  
  private clearStoredValues(): void {
    const count = Object.keys(Store.storage).length
    Store.storage = {}
    this.log(`✅ Cleared all stored values (${count} values removed)`)
  }
  
  // Public method to access storage from other commands
  public static getStoredValue(key: string): any {
    return Store.storage[key]
  }
  
  // Public method to get all stored values
  public static getAllStoredValues(): Record<string, any> {
    return { ...Store.storage }
  }
}