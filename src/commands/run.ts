import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { promises as fs } from 'fs'
import * as yaml from 'yaml'
import chalk from 'chalk'
import { Page } from 'playwright'

interface WorkflowStep {
  [command: string]: any
}

interface WorkflowOptions {
  strict?: boolean
  variables?: Record<string, string>
  timeout?: number
}

export default class Run extends BaseCommand {
  private parsedFlags: any
  static description = 'Run a workflow from a YAML file or stdin'

  static examples = [
    '<%= config.bin %> <%= command.id %> workflow.yml',
    '<%= config.bin %> <%= command.id %> --file automation.yml --strict',
    'echo "navigate: https://example.com\\nwait: {selector: body}" | <%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> test.yml --var USER=john --var PASS=secret',
  ]

  static args = {
    file: Args.string({
      description: 'YAML workflow file to run',
      required: false,
    }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    strict: Flags.boolean({
      description: 'Stop on first error (default: true)',
      default: true,
    }),
    'continue-on-error': Flags.boolean({
      description: 'Continue execution even if a step fails',
      default: false,
    }),
    var: Flags.string({
      description: 'Set workflow variables (KEY=VALUE)',
      multiple: true,
    }),
    timeout: Flags.integer({
      description: 'Default timeout for commands in milliseconds',
      default: 30000,
    }),
    'dry-run': Flags.boolean({
      description: 'Parse and validate workflow without executing',
      default: false,
    }),
  }

  private variables: Record<string, string> = {}
  private stepCount = 0
  private successCount = 0
  private failureCount = 0

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Run)
    this.parsedFlags = flags
    
    // Parse variables
    if (flags.var) {
      for (const varDef of flags.var) {
        const [key, ...valueParts] = varDef.split('=')
        if (key && valueParts.length > 0) {
          this.variables[key] = valueParts.join('=')
        }
      }
    }

    // Load workflow
    let workflowContent: string
    
    if (args.file) {
      // Read from file
      workflowContent = await fs.readFile(args.file, 'utf-8')
      this.log(chalk.cyan(`📋 Loading workflow from: ${args.file}`))
    } else if (process.stdin.isTTY === false) {
      // Read from stdin
      workflowContent = await this.readStdin()
      this.log(chalk.cyan('📋 Loading workflow from stdin'))
    } else {
      this.error('No workflow file specified. Provide a file path or pipe content to stdin.')
    }

    // Parse YAML
    let workflow: WorkflowStep[]
    try {
      const parsed = yaml.parse(workflowContent)
      workflow = Array.isArray(parsed) ? parsed : [parsed]
    } catch (error: any) {
      this.error(`Failed to parse YAML: ${error.message}`)
    }

    if (flags['dry-run']) {
      this.log(chalk.yellow('🔍 Dry run mode - validating workflow'))
      this.validateWorkflow(workflow)
      this.log(chalk.green('✅ Workflow is valid'))
      return
    }

    // Connect to Chrome
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

    // Execute workflow
    const options: WorkflowOptions = {
      strict: flags.strict && !flags['continue-on-error'],
      variables: this.variables,
      timeout: flags.timeout,
    }

    await this.executeWorkflow(workflow, this.page!, options)

    // Show summary
    this.showSummary()
  }

  private async readStdin(): Promise<string> {
    const chunks: Buffer[] = []
    
    for await (const chunk of process.stdin) {
      chunks.push(chunk)
    }
    
    return Buffer.concat(chunks).toString('utf-8')
  }

  private validateWorkflow(workflow: WorkflowStep[]): void {
    if (!Array.isArray(workflow) || workflow.length === 0) {
      this.error('Workflow must contain at least one step')
    }

    workflow.forEach((step, index) => {
      if (typeof step !== 'object' || step === null) {
        this.error(`Step ${index + 1} must be an object`)
      }

      const commands = Object.keys(step)
      if (commands.length === 0) {
        this.error(`Step ${index + 1} must contain a command`)
      }

      if (commands.length > 1) {
        this.warn(`Step ${index + 1} contains multiple commands - only first will be executed`)
      }
    })
  }

  private async executeWorkflow(
    workflow: WorkflowStep[], 
    page: Page, 
    options: WorkflowOptions
  ): Promise<void> {
    this.log(chalk.cyan(`\n🚀 Executing workflow with ${workflow.length} steps\n`))

    for (const [index, step] of workflow.entries()) {
      this.stepCount++
      const stepNumber = index + 1
      
      // Get command and args
      const command = Object.keys(step)[0]
      let args = step[command]
      
      // Replace variables
      args = this.replaceVariables(args, options.variables || {})
      
      this.log(chalk.blue(`[${stepNumber}/${workflow.length}] ${command}`))
      
      try {
        await this.executeStep(command, args, page, options)
        this.successCount++
        this.log(chalk.green(`    ✅ Success`))
      } catch (error: any) {
        this.failureCount++
        this.log(chalk.red(`    ❌ Failed: ${error.message}`))
        
        if (options.strict) {
          this.error(`Workflow failed at step ${stepNumber}: ${error.message}`)
        }
      }
      
      // Add small delay between steps
      await page.waitForTimeout(100)
    }
  }

  private async executeStep(
    command: string, 
    args: any, 
    page: Page,
    options: WorkflowOptions
  ): Promise<void> {
    const timeout = options.timeout || 30000

    switch (command) {
      case 'navigate':
      case 'goto':
        const url = typeof args === 'string' ? args : args.url
        await page.goto(url, { 
          waitUntil: args.waitUntil || 'load',
          timeout 
        })
        break

      case 'click':
        const clickSelector = typeof args === 'string' ? args : args.selector
        await page.click(clickSelector, {
          button: args.button || 'left',
          clickCount: args.clickCount || 1,
          timeout,
        })
        break

      case 'type':
        const typeSelector = typeof args === 'string' 
          ? args.split(' ')[0] 
          : args.selector
        const text = typeof args === 'string' 
          ? args.split(' ').slice(1).join(' ')
          : args.text
        
        await page.type(typeSelector, text, {
          delay: args.delay || 0,
        })
        
        if (args.submit || args.enter) {
          await page.press(typeSelector, 'Enter')
        }
        break

      case 'wait':
        if (typeof args === 'string') {
          await page.waitForSelector(args, { 
            state: 'visible',
            timeout 
          })
        } else if (args.selector) {
          await page.waitForSelector(args.selector, {
            state: args.state || 'visible',
            timeout: args.timeout || timeout,
          })
        } else if (args.time || args.ms) {
          await page.waitForTimeout(args.time || args.ms)
        } else if (args.url) {
          await page.waitForURL(args.url, { timeout })
        }
        break

      case 'screenshot':
        const path = typeof args === 'string' ? args : args.path
        await page.screenshot({
          path,
          fullPage: args.fullPage !== false,
          type: args.type || 'png',
        })
        break

      case 'evaluate':
      case 'eval':
        const code = typeof args === 'string' ? args : args.code
        const result = await page.evaluate(code)
        if (this.parsedFlags.verbose) {
          this.log(chalk.gray(`    Result: ${JSON.stringify(result)}`))
        }
        break

      case 'select':
        const selectSelector = typeof args === 'string' 
          ? args.split(' ')[0]
          : args.selector
        const value = typeof args === 'string'
          ? args.split(' ').slice(1).join(' ')
          : args.value
        
        await page.selectOption(selectSelector, value)
        break

      case 'hover':
        const hoverSelector = typeof args === 'string' ? args : args.selector
        await page.hover(hoverSelector, {
          timeout,
          position: args.position,
        })
        break

      case 'scroll':
        if (typeof args === 'string') {
          await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
        } else if (args.to) {
          await page.evaluate(({ selector }) => {
            document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' })
          }, { selector: args.to })
        } else if (args.by) {
          await page.evaluate(({ pixels }) => {
            window.scrollBy(0, pixels)
          }, { pixels: args.by })
        }
        break

      case 'fill':
        if (typeof args === 'object' && args.form) {
          for (const [field, value] of Object.entries(args.form)) {
            await page.fill(`[name="${field}"]`, String(value))
          }
        }
        break

      case 'press':
        const key = typeof args === 'string' ? args : args.key
        await page.keyboard.press(key)
        break

      case 'reload':
      case 'refresh':
        await page.reload({ waitUntil: args.waitUntil || 'load' })
        break

      case 'back':
        await page.goBack({ waitUntil: args.waitUntil || 'load' })
        break

      case 'forward':
        await page.goForward({ waitUntil: args.waitUntil || 'load' })
        break

      default:
        throw new Error(`Unknown command: ${command}`)
    }
  }

  private replaceVariables(value: any, variables: Record<string, string>): any {
    if (typeof value === 'string') {
      // Replace ${VAR} patterns
      return value.replace(/\$\{(\w+)\}/g, (match, varName) => {
        return variables[varName] || match
      })
    } else if (Array.isArray(value)) {
      return value.map(item => this.replaceVariables(item, variables))
    } else if (typeof value === 'object' && value !== null) {
      const result: any = {}
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.replaceVariables(val, variables)
      }
      return result
    }
    
    return value
  }

  private showSummary(): void {
    this.log('')
    this.log(chalk.cyan('📊 Workflow Summary:'))
    this.log(`   Total steps: ${this.stepCount}`)
    this.log(`   ${chalk.green('Successful:')} ${this.successCount}`)
    if (this.failureCount > 0) {
      this.log(`   ${chalk.red('Failed:')} ${this.failureCount}`)
    }
    
    const successRate = this.stepCount > 0 
      ? Math.round((this.successCount / this.stepCount) * 100)
      : 0
    
    if (successRate === 100) {
      this.log(chalk.green(`\n✅ All steps completed successfully!`))
    } else if (successRate > 0) {
      this.log(chalk.yellow(`\n⚠️  ${successRate}% success rate`))
    } else {
      this.log(chalk.red(`\n❌ Workflow failed`))
    }
  }
}