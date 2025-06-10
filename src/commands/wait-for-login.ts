import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'

export default class WaitForLogin extends BaseCommand {
  static description = 'Navigate to a URL and wait for user to complete login before continuing'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://gmail.com',
    '<%= config.bin %> <%= command.id %> https://github.com --ready-selector ".Header-link--profile"',
    '<%= config.bin %> <%= command.id %> https://app.example.com --ready-selector "#dashboard" --profile work',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'ready-selector': Flags.string({
      char: 'r',
      description: 'CSS selector that indicates successful login (default: body)',
      default: 'body',
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Maximum time to wait for login in milliseconds',
      default: 300000, // 5 minutes
    }),
  }

  static args = {
    url: Args.string({
      description: 'URL to navigate to and wait for login',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WaitForLogin)
    
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

    await this.waitForLogin(args.url, flags['ready-selector'])
  }
}