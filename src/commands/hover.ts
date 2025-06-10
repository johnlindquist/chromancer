import { Args, Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'
import { waitForElement } from '../utils/selectors.js'
import { handleCommandError } from '../utils/errors.js'

export default class Hover extends BaseCommand {
  static description = 'Hover over an element to trigger hover states and tooltips'

  static examples = [
    '<%= config.bin %> <%= command.id %> "#menu-item"',
    '<%= config.bin %> <%= command.id %> ".dropdown-toggle" --duration 2000',
    '<%= config.bin %> <%= command.id %> "button.info" --wait-for ".tooltip"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    duration: Flags.integer({
      char: 'd',
      description: 'Duration to keep hovering in milliseconds',
      default: 0,
    }),
    'wait-for': Flags.string({
      description: 'Wait for element to appear after hovering',
    }),
    position: Flags.string({
      description: 'Hover position relative to element (format: x,y)',
    }),
    force: Flags.boolean({
      description: 'Force hover even if element is obscured',
      default: false,
    }),
  }

  static args = {
    selector: Args.string({
      required: true,
      description: 'CSS selector of element to hover over',
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Hover)
    
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

    await this.executeCommand(this.page!, args.selector, flags)
  }

  private async executeCommand(page: Page, selector: string, flags: any): Promise<void> {
    try {
      this.logVerbose(`Looking for element: ${selector}`)
      
      // Wait for element to be present and visible
      await waitForElement(page, selector, { 
        state: 'visible',
        timeout: 30000 
      })
      
      // Build hover options
      const hoverOptions: any = {
        force: flags.force,
      }

      // Parse position if provided
      if (flags.position) {
        const [x, y] = flags.position.split(',').map((n: string) => parseInt(n.trim(), 10))
        if (!isNaN(x) && !isNaN(y)) {
          hoverOptions.position = { x, y }
          this.logVerbose('Hover position', { x, y })
        } else {
          this.warn('Invalid position format, ignoring position flag')
        }
      }

      this.log(`🎯 Hovering over element: ${selector}`)
      
      // Move mouse to element
      await page.hover(selector, hoverOptions)
      
      this.log(`✅ Hovered over element: ${selector}`)
      
      // Wait for secondary element if specified
      if (flags['wait-for']) {
        this.log(`⏳ Waiting for: ${flags['wait-for']}`)
        try {
          await waitForElement(page, flags['wait-for'], {
            state: 'visible',
            timeout: 5000
          })
          this.log(`✅ Element appeared: ${flags['wait-for']}`)
        } catch (error) {
          this.warn(`Element did not appear: ${flags['wait-for']}`)
        }
      }
      
      // If duration specified, keep hovering
      if (flags.duration > 0) {
        this.logVerbose(`Keeping hover for ${flags.duration}ms`)
        await new Promise(resolve => setTimeout(resolve, flags.duration))
      }

      // Log element info if verbose
      if (flags.verbose) {
        try {
          const elementInfo = await page.$eval(selector, (el: Element) => {
            const rect = el.getBoundingClientRect()
            const styles = window.getComputedStyle(el)
            return {
              tagName: el.tagName.toLowerCase(),
              position: { x: rect.x, y: rect.y },
              size: { width: rect.width, height: rect.height },
              cursor: styles.cursor,
              hasTitle: !!el.getAttribute('title'),
              hasTooltip: !!el.getAttribute('data-tooltip') || !!el.getAttribute('data-bs-tooltip'),
            }
          })
          this.logVerbose('Hovered element info', elementInfo)
        } catch {
          // Element may have changed after hover
        }
      }
      
    } catch (error: any) {
      const commandError = handleCommandError(error, 'hover', selector)
      this.error(commandError.message)
    }
  }
}