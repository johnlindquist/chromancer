import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { handleCommandError } from '../utils/errors.js'

export default class Keypress extends BaseCommand {
  static description = 'Press keyboard keys (single keys or combinations)'

  static examples = [
    '<%= config.bin %> <%= command.id %> Enter',
    '<%= config.bin %> <%= command.id %> Escape',
    '<%= config.bin %> <%= command.id %> Tab',
    '<%= config.bin %> <%= command.id %> "Control+A"',
    '<%= config.bin %> <%= command.id %> "Meta+C" # Cmd+C on Mac',
    '<%= config.bin %> <%= command.id %> ArrowDown --repeat 3',
    '<%= config.bin %> <%= command.id %> Space --selector ".focused-element"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    selector: Flags.string({
      char: 's',
      description: 'Target element selector (if not specified, sends key globally)',
    }),
    repeat: Flags.integer({
      char: 'r',
      description: 'Number of times to repeat the keypress',
      default: 1,
    }),
    delay: Flags.integer({
      char: 'd',
      description: 'Delay between repeated keypresses in milliseconds',
      default: 100,
    }),
  }

  static args = {
    key: Args.string({
      description: 'Key or key combination to press (e.g., Enter, Escape, Control+A)',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Keypress)
    
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
      // Focus on element if selector is provided
      if (flags.selector) {
        this.log(`🎯 Focusing on element: ${flags.selector}`)
        await this.page!.focus(flags.selector)
      }

      // Press key(s)
      for (let i = 0; i < flags.repeat; i++) {
        if (i > 0 && flags.delay > 0) {
          await this.page!.waitForTimeout(flags.delay)
        }
        
        this.log(`⌨️  Pressing: ${args.key}${flags.repeat > 1 ? ` (${i + 1}/${flags.repeat})` : ''}`)
        
        if (flags.selector) {
          // Press key on specific element
          await this.page!.press(flags.selector, args.key)
        } else {
          // Press key globally
          await this.page!.keyboard.press(args.key)
        }
      }

      this.log(`✅ Successfully pressed: ${args.key}${flags.repeat > 1 ? ` (${flags.repeat} times)` : ''}`)

      // Log additional info if verbose
      if (flags.verbose) {
        this.logVerbose('Keypress details', {
          key: args.key,
          selector: flags.selector || 'global',
          repeat: flags.repeat,
          delay: flags.delay,
        })
      }
    } catch (error: any) {
      const commandError = handleCommandError(error, 'keypress', args.key)
      this.error(commandError.message)
    }
  }
}