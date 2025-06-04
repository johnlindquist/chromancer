import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base'

export default class Type extends BaseCommand {
  static description = 'Type text into an element'

  static examples = [
    '<%= config.bin %> <%= command.id %> "input[name=email]" "user@example.com"',
    '<%= config.bin %> <%= command.id %> "#search-box" "search query" --clear-first',
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
  }

  static args = {
    selector: Args.string({
      description: 'CSS selector of element to type into',
      required: true,
    }),
    text: Args.string({
      description: 'Text to type',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Type)
    
    await this.connectToChrome(flags.port, flags.host, flags.launch, flags.verbose, flags.keepOpen)
    
    if (!this.page) {
      this.error('No page available')
    }

    try {
      if (flags['wait-for-selector']) {
        this.log(`Waiting for selector: ${args.selector}`)
        await this.page.waitForSelector(args.selector, {
          timeout: flags.timeout,
        })
      }

      if (flags['clear-first']) {
        this.log(`Clearing existing text in: ${args.selector}`)
        await this.page.click(args.selector, { clickCount: 3 })
        await this.page.keyboard.press('Backspace')
      }

      this.log(`Typing into: ${args.selector}`)
      await this.page.type(args.selector, args.text, {
        delay: flags.delay,
      })
      this.log(`Successfully typed "${args.text}" into: ${args.selector}`)
    } catch (error) {
      this.error(`Failed to type: ${error}`)
    }
  }
}