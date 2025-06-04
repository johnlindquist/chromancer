import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base'

export default class Click extends BaseCommand {
  static description = 'Click an element by CSS selector'

  static examples = [
    '<%= config.bin %> <%= command.id %> "button.submit"',
    '<%= config.bin %> <%= command.id %> "#login-button" --wait-for-selector',
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
  }

  static args = {
    selector: Args.string({
      description: 'CSS selector of element to click',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Click)
    
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

      this.log(`Clicking on: ${args.selector}`)
      await this.page.click(args.selector, {
        clickCount: flags['click-count'],
        button: flags.button as 'left' | 'right' | 'middle',
      })
      this.log(`Successfully clicked on: ${args.selector}`)
    } catch (error) {
      this.error(`Failed to click: ${error}`)
    }
  }
}