import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base'

export default class Evaluate extends BaseCommand {
  static description = 'Execute JavaScript in the page context'

  static examples = [
    '<%= config.bin %> <%= command.id %> "document.title"',
    '<%= config.bin %> <%= command.id %> "document.querySelectorAll(\'a\').length" --return-result',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'return-result': Flags.boolean({
      description: 'Print the result of the evaluation',
      default: true,
    }),
  }

  static args = {
    script: Args.string({
      description: 'JavaScript code to execute',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Evaluate)
    
    await this.connectToChrome(flags.port, flags.host)
    
    if (!this.page) {
      this.error('No page available')
    }

    try {
      this.log(`Evaluating JavaScript...`)
      const result = await this.page.evaluate(args.script)
      
      if (flags['return-result']) {
        this.log('Result:')
        this.log(JSON.stringify(result, null, 2))
      } else {
        this.log('JavaScript executed successfully')
      }
    } catch (error) {
      this.error(`Failed to evaluate JavaScript: ${error}`)
    }
  }
}