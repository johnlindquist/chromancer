import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { waitForElement } from '../utils/selectors.js'
import { handleCommandError } from '../utils/errors.js'

export default class Type extends BaseCommand {
  static description = 'Type text into an element'

  static examples = [
    '<%= config.bin %> <%= command.id %> "input[name=email]" "user@example.com"',
    '<%= config.bin %> <%= command.id %> "#search-box" "search query" --clear-first',
    '<%= config.bin %> <%= command.id %> "textarea" "multi\\nline\\ntext" --press-enter',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'clear-first': Flags.boolean({
      description: 'Clear existing text before typing',
      default: false,
    }),
    delay: Flags.integer({
      description: 'Delay between key presses in milliseconds',
      default: 0,
    }),
    'wait-for-selector': Flags.boolean({
      description: 'Wait for selector to be available before typing',
      default: true,
    }),
    timeout: Flags.integer({
      description: 'Maximum time to wait for selector in milliseconds',
      default: 30000,
    }),
    'press-enter': Flags.boolean({
      description: 'Press Enter key after typing',
      default: false,
    }),
    'press-tab': Flags.boolean({
      description: 'Press Tab key after typing',
      default: false,
    }),
  }

  static args = {
    selector: Args.string({
      description: 'CSS selector of element to type into',
      required: true,
    }),
    text: Args.string({
      description: 'Text to type (use \\n for newlines)',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Type)
    
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
      if (flags['wait-for-selector']) {
        this.log(`⏳ Waiting for selector: ${args.selector}`)
        await waitForElement(this.page!, args.selector, { 
          timeout: flags.timeout,
          state: 'visible' 
        })
      }

      // Focus the element first
      await this.page!.focus(args.selector)

      if (flags['clear-first']) {
        this.log(`🧹 Clearing existing text in: ${args.selector}`)
        // Playwright's fill method clears by default, but for type we need to manually clear
        await this.page!.click(args.selector, { clickCount: 3 })
        await this.page!.keyboard.press('Delete')
      }

      // Process text to handle escape sequences
      const processedText = args.text.replace(/\\n/g, '\n').replace(/\\t/g, '\t')

      this.log(`⌨️  Typing into: ${args.selector}`)
      this.logVerbose('Type options', {
        text: processedText,
        delay: flags.delay,
        clearFirst: flags['clear-first'],
      })

      // Use type method for more natural typing with delay
      await this.page!.type(args.selector, processedText, {
        delay: flags.delay,
      })

      // Press additional keys if requested
      if (flags['press-enter']) {
        this.log('⏎ Pressing Enter')
        await this.page!.keyboard.press('Enter')
      }

      if (flags['press-tab']) {
        this.log('⇥ Pressing Tab')
        await this.page!.keyboard.press('Tab')
      }

      this.log(`✅ Successfully typed text into: ${args.selector}`)

      // Log element value if verbose
      if (flags.verbose) {
        try {
          const elementInfo = await this.page!.$eval(args.selector, (el: Element) => {
            const input = el as HTMLInputElement | HTMLTextAreaElement
            return {
              tagName: el.tagName.toLowerCase(),
              type: (el as HTMLInputElement).type || null,
              value: input.value || null,
              textContent: el.textContent?.trim().substring(0, 50),
            }
          })
          this.logVerbose('Element state after typing', elementInfo)
        } catch {
          // Element may not support value property
        }
      }
    } catch (error: any) {
      const commandError = handleCommandError(error, 'type', args.selector)
      this.error(commandError.message)
    }
  }
}