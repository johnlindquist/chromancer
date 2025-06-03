import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base'
import * as fs from 'fs/promises'
import * as path from 'path'

export default class Screenshot extends BaseCommand {
  static description = 'Take a screenshot of the current page'

  static examples = [
    '<%= config.bin %> <%= command.id %> screenshot.png',
    '<%= config.bin %> <%= command.id %> fullpage.png --full-page',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'full-page': Flags.boolean({
      description: 'Capture full scrollable page',
      default: false,
    }),
    format: Flags.string({
      description: 'Screenshot format',
      options: ['png', 'jpeg'],
      default: 'png',
    }),
    quality: Flags.integer({
      description: 'Quality (0-100) for JPEG format',
      default: 80,
    }),
  }

  static args = {
    filename: Args.string({
      description: 'Output filename',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Screenshot)
    
    await this.connectToChrome(flags.port, flags.host)
    
    if (!this.page) {
      this.error('No page available')
    }

    try {
      this.log(`Taking screenshot...`)
      
      const screenshotOptions: any = {
        path: args.filename,
        fullPage: flags['full-page'],
        type: flags.format as 'png' | 'jpeg',
      }
      
      if (flags.format === 'jpeg') {
        screenshotOptions.quality = flags.quality
      }
      
      await this.page.screenshot(screenshotOptions)
      
      const absolutePath = path.resolve(args.filename)
      this.log(`Screenshot saved to: ${absolutePath}`)
    } catch (error) {
      this.error(`Failed to take screenshot: ${error}`)
    }
  }
}