import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base'

export default class Navigate extends BaseCommand {
  static description = 'Navigate to a URL in Chrome'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://example.com',
    '<%= config.bin %> <%= command.id %> https://example.com --wait-until networkidle0',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'wait-until': Flags.string({
      description: 'When to consider navigation succeeded',
      options: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
      default: 'load',
    }),
    timeout: Flags.integer({
      description: 'Maximum navigation time in milliseconds',
      default: 30000,
    }),
  }

  static args = {
    url: Args.string({
      description: 'URL to navigate to',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Navigate)
    
    await this.connectToChrome(flags.port, flags.host)
    
    if (!this.page) {
      this.error('No page available')
    }

    try {
      this.log(`Navigating to ${args.url}...`)
      await this.page.goto(args.url, {
        waitUntil: flags['wait-until'] as any,
        timeout: flags.timeout,
      })
      this.log(`Successfully navigated to ${args.url}`)
    } catch (error) {
      this.error(`Failed to navigate: ${error}`)
    }
  }
}