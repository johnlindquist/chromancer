import { Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'
import { waitForElement } from '../utils/selectors.js'
import { handleCommandError, isTimeoutError } from '../utils/errors.js'

export default class Wait extends BaseCommand {
  static description = 'Wait for elements or conditions before proceeding'

  static examples = [
    '<%= config.bin %> <%= command.id %> --selector "#dynamic-content"',
    '<%= config.bin %> <%= command.id %> --selector ".loading" --hidden',
    '<%= config.bin %> <%= command.id %> --condition "document.readyState === \'complete\'"',
    '<%= config.bin %> <%= command.id %> --page-load',
    '<%= config.bin %> <%= command.id %> --network-idle',
    '<%= config.bin %> <%= command.id %> --url "https://example.com"',
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
    url: Flags.string({
      description: 'Wait for URL to match (supports partial match)',
    }),
    text: Flags.string({
      description: 'Wait for text to appear in the page',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Wait)
    
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

    await this.executeCommand(this.page!)
  }

  private async executeCommand(page: Page): Promise<void> {
    const { flags } = await this.parse(Wait)
    
    const waitPromises: Promise<any>[] = []
    const waitDescriptions: string[] = []

    // Wait for selector with visibility state
    if (flags.selector) {
      if (flags.visible) {
        waitPromises.push(
          waitForElement(page, flags.selector, { 
            state: 'visible', 
            timeout: flags.timeout 
          })
        )
        waitDescriptions.push(`element "${flags.selector}" to be visible`)
      } else if (flags.hidden) {
        waitPromises.push(
          waitForElement(page, flags.selector, { 
            state: 'hidden', 
            timeout: flags.timeout 
          })
        )
        waitDescriptions.push(`element "${flags.selector}" to be hidden`)
      } else {
        waitPromises.push(
          waitForElement(page, flags.selector, { 
            timeout: flags.timeout 
          })
        )
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
      waitPromises.push(page.waitForLoadState('load', {
        timeout: flags.timeout,
      }))
      waitDescriptions.push('page load')
    }

    // Wait for network idle
    if (flags['network-idle']) {
      waitPromises.push(page.waitForLoadState('networkidle', {
        timeout: flags.timeout,
      }))
      waitDescriptions.push('network idle')
    }

    // Wait for URL
    if (flags.url) {
      waitPromises.push(page.waitForURL(flags.url, {
        timeout: flags.timeout,
      }))
      waitDescriptions.push(`URL to match "${flags.url}"`)
    }

    // Wait for text
    if (flags.text) {
      waitPromises.push(
        page.waitForFunction(
          (text) => document.body.textContent?.includes(text),
          flags.text,
          { timeout: flags.timeout }
        )
      )
      waitDescriptions.push(`text "${flags.text}" to appear`)
    }

    // If no wait conditions specified, show error
    if (waitPromises.length === 0) {
      this.error('No wait condition specified. Use --selector, --condition, --page-load, --network-idle, --url, or --text')
    }

    try {
      this.log(`⏳ Waiting for ${waitDescriptions.join(' and ')}...`)
      
      // Wait for all conditions
      await Promise.all(waitPromises)
      
      if (waitDescriptions.length === 1) {
        if (flags.selector && flags.visible) {
          this.log(`✅ Element is visible: ${flags.selector}`)
        } else if (flags.selector && flags.hidden) {
          this.log(`✅ Element is hidden: ${flags.selector}`)
        } else if (flags.selector) {
          this.log(`✅ Element found: ${flags.selector}`)
        } else if (flags.condition) {
          this.log(`✅ Condition met: ${flags.condition}`)
        } else if (flags['page-load']) {
          this.log('✅ Page loaded')
        } else if (flags['network-idle']) {
          this.log('✅ Network idle')
        } else if (flags.url) {
          this.log(`✅ URL matched: ${page.url()}`)
        } else if (flags.text) {
          this.log(`✅ Text found: "${flags.text}"`)
        }
      } else {
        this.log(`✅ All conditions met`)
      }

      // Log additional info if verbose
      if (flags.verbose) {
        this.logVerbose('Wait completed', {
          conditions: waitDescriptions,
          currentUrl: page.url(),
          title: await page.title(),
        })
      }
    } catch (error: any) {
      if (isTimeoutError(error)) {
        this.error(`Timeout waiting for ${waitDescriptions.join(' and ')} (${flags.timeout}ms)`)
      }
      const commandError = handleCommandError(error, 'wait')
      this.error(commandError.message)
    }
  }
}