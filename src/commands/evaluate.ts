import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { safeEvaluate } from '../utils/evaluation.js'

export default class Evaluate extends BaseCommand {
  static description = 'Execute JavaScript in the page context'

  static examples = [
    '<%= config.bin %> <%= command.id %> "document.title"',
    '<%= config.bin %> <%= command.id %> "document.querySelectorAll(\'a\').length" --return-result',
    '<%= config.bin %> <%= command.id %> "localStorage.getItem(\'token\')" --json',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'return-result': Flags.boolean({
      description: 'Print the result of the evaluation',
      default: true,
    }),
    json: Flags.boolean({
      description: 'Output result as raw JSON',
      default: false,
    }),
    selector: Flags.string({
      description: 'Evaluate within the context of a specific element',
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
      this.log(`🔧 Evaluating JavaScript...`)
      this.logVerbose('Script to evaluate', { script: args.script })

      let result: any

      if (flags.selector) {
        // Evaluate within element context
        this.log(`📍 Using element context: ${flags.selector}`)
        const element = await this.page!.$(flags.selector)
        if (!element) {
          this.error(`Element not found: ${flags.selector}`)
        }
        
        result = await element!.evaluate((el, script) => {
          // Create a function that has 'el' in scope
          const fn = new Function('el', `return ${script}`)
          return fn(el)
        }, args.script)
      } else {
        // Evaluate in page context
        result = await safeEvaluate(this.page!, args.script)
      }
      
      if (flags['return-result']) {
        if (flags.json) {
          // Raw JSON output for scripting
          console.log(JSON.stringify(result))
        } else {
          // Pretty formatted output
          this.log('📤 Result:')
          if (result === undefined) {
            this.log('undefined')
          } else if (result === null) {
            this.log('null')
          } else if (typeof result === 'object') {
            this.log(JSON.stringify(result, null, 2))
          } else {
            this.log(String(result))
          }
        }

        // Log type information if verbose
        if (flags.verbose && !flags.json) {
          this.logVerbose('Result type', {
            type: typeof result,
            isArray: Array.isArray(result),
            constructor: result?.constructor?.name,
          })
        }
      } else {
        this.log('✅ JavaScript executed successfully')
      }

      // Log performance metrics if verbose
      if (flags.verbose) {
        const metrics = await this.page!.evaluate(() => {
          if (typeof performance !== 'undefined' && (performance as any).memory) {
            return {
              usedJSHeapSize: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB',
              totalJSHeapSize: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + 'MB',
            }
          }
          return null
        })
        if (metrics) {
          this.logVerbose('Memory usage', metrics)
        }
      }
    } catch (error: any) {
      if (error.name === 'SyntaxError' || error.message.includes('SyntaxError')) {
        this.error(`JavaScript syntax error: ${error.message}`)
      }
      this.error(`Failed to evaluate JavaScript: ${error.message}`)
    }
  }
}