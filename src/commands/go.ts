import { Args } from '@oclif/core'
import Navigate from './navigate.js'

export default class Go extends Navigate {
  static description = 'Alias for navigate - go to a URL'

  static examples = [
    '<%= config.bin %> <%= command.id %> https://example.com',
    '<%= config.bin %> <%= command.id %> example.com',
  ]

  static args = {
    url: Args.string({
      description: 'URL to navigate to',
      required: true,
    }),
  }

  static flags = Navigate.flags

  async run(): Promise<void> {
    // Simply run the parent navigate command
    await super.run()
  }
}