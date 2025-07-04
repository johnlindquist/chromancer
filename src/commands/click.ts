import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { waitForElement } from '../utils/selectors.js'
import { handleCommandError } from '../utils/errors.js'
import { checkMultipleMatches, formatElementMatches, getInteractiveSelection } from '../utils/selector-disambiguation.js'

export default class Click extends BaseCommand {
  static description = 'Click an element by CSS selector'

  static examples = [
    '<%= config.bin %> <%= command.id %> "button.submit"',
    '<%= config.bin %> <%= command.id %> "#login-button" --wait-for-selector',
    '<%= config.bin %> <%= command.id %> "a.link" --right-click',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'wait-for-selector': Flags.boolean({
      description: 'Wait for selector to be available before clicking',
      default: true,
    }),
    timeout: Flags.integer({
      description: 'Maximum time to wait for selector in milliseconds',
      default: 30000,
    }),
    'click-count': Flags.integer({
      description: 'Number of clicks',
      default: 1,
    }),
    button: Flags.string({
      description: 'Mouse button to use',
      options: ['left', 'right', 'middle'],
      default: 'left',
    }),
    'right-click': Flags.boolean({
      description: 'Perform a right-click instead of left-click',
      default: false,
    }),
    position: Flags.string({
      description: 'Click position relative to element (format: x,y)',
    }),
    modifiers: Flags.string({
      description: 'Modifier keys to press during click (comma-separated: Alt,Control,Meta,Shift)',
    }),
    force: Flags.boolean({
      description: 'Force click even if element is obscured',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactively select element when multiple matches are found',
      default: false,
    }),
  }

  static args = {
    selector: Args.string({
      description: 'CSS selector of element to click',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Click)
    
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

    try {
      // Check for multiple matches first
      const { count, elements } = await checkMultipleMatches(this.page!, args.selector)
      
      if (count === 0) {
        this.error(`No elements found matching: ${args.selector}`)
      }
      
      let finalSelector = args.selector
      
      if (count > 1) {
        this.log(`⚠️  Multiple elements found matching: ${args.selector}`)
        
        if (flags.interactive && elements) {
          const selected = await getInteractiveSelection(elements)
          if (selected) {
            finalSelector = selected
            this.log(`✅ Using selector: ${finalSelector}`)
          } else {
            this.error('No element selected')
          }
        } else if (elements) {
          this.log('\n' + formatElementMatches(elements))
          this.error('Multiple elements found. Use a more specific selector or --interactive flag')
        }
      }
      
      if (flags['wait-for-selector']) {
        this.log(`⏳ Waiting for selector: ${finalSelector}`)
        await waitForElement(this.page!, finalSelector, { timeout: flags.timeout })
      }

      // Parse click options
      const clickOptions: any = {
        clickCount: flags['click-count'],
        button: flags['right-click'] ? 'right' : flags.button as 'left' | 'right' | 'middle',
        force: flags.force,
      }

      // Parse position if provided
      if (flags.position) {
        const [x, y] = flags.position.split(',').map(n => parseInt(n.trim(), 10))
        if (!isNaN(x) && !isNaN(y)) {
          clickOptions.position = { x, y }
          this.logVerbose('Click position', { x, y })
        } else {
          this.warn('Invalid position format, ignoring position flag')
        }
      }

      // Parse modifiers if provided
      if (flags.modifiers) {
        clickOptions.modifiers = flags.modifiers
          .split(',')
          .map(m => m.trim())
          .filter(m => ['Alt', 'Control', 'Meta', 'Shift'].includes(m))
        if (clickOptions.modifiers.length > 0) {
          this.logVerbose('Click modifiers', clickOptions.modifiers)
        }
      }

      this.log(`🖱️  Clicking on: ${finalSelector}`)
      this.logVerbose('Click options', clickOptions)

      await this.page!.click(finalSelector, clickOptions)
      
      this.log(`✅ Successfully clicked on: ${finalSelector}`)

      // Log element info if verbose
      if (flags.verbose) {
        try {
          const elementInfo = await this.page!.$eval(finalSelector, (el: Element) => {
            const rect = el.getBoundingClientRect()
            return {
              tagName: el.tagName.toLowerCase(),
              text: el.textContent?.trim().substring(0, 50),
              classList: Array.from(el.classList),
              position: { x: rect.x, y: rect.y },
              size: { width: rect.width, height: rect.height },
            }
          })
          this.logVerbose('Clicked element info', elementInfo)
        } catch {
          // Element may have been removed after click
        }
      }
    } catch (error: any) {
      const commandError = handleCommandError(error, 'click', args.selector)
      this.error(commandError.message)
    }
  }
}