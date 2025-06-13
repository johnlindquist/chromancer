import { Args, Flags, Command } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { WorkflowStorage } from '../utils/workflow-storage.js'
import { WorkflowExecutor } from '../utils/workflow-executor.js'
import * as yaml from 'yaml'
import * as fs from 'node:fs/promises'
import inquirer from 'inquirer'
import type { SavedWorkflow } from '../types/workflow.js'

// Create a chalk-like interface for colorization
const chalk = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

export default class Workflows extends BaseCommand {
  static description = 'Manage saved Chromancer workflows'

  static examples = [
    '<%= config.bin %> <%= command.id %> list',
    '<%= config.bin %> <%= command.id %> run "login flow"',
    '<%= config.bin %> <%= command.id %> show "scrape data"',
    '<%= config.bin %> <%= command.id %> delete "old workflow"',
    '<%= config.bin %> <%= command.id %> export "my workflow" --output workflow.yml',
  ]

  static args = {
    action: Args.string({
      description: 'Action to perform',
      options: ['list', 'run', 'show', 'delete', 'export', 'import'],
      required: false,
    }),
    name: Args.string({
      description: 'Workflow name or ID',
      required: false,
    }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    tags: Flags.string({
      description: 'Filter by tags (comma-separated)',
      multiple: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file for export',
    }),
    file: Flags.string({
      char: 'f',
      description: 'Input file for import',
    }),
  }

  private storage = new WorkflowStorage()

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Workflows)

    // If no action specified, show interactive menu
    if (!args.action) {
      await this.showInteractiveMenu(flags)
      return
    }

    switch (args.action) {
      case 'list':
        await this.listWorkflows(flags)
        break
      case 'run':
        if (!args.name) this.error('Workflow name or ID required')
        await this.runWorkflow(args.name, flags)
        break
      case 'show':
        if (!args.name) this.error('Workflow name or ID required')
        await this.showWorkflow(args.name)
        break
      case 'delete':
        if (!args.name) this.error('Workflow name or ID required')
        await this.deleteWorkflow(args.name)
        break
      case 'export':
        if (!args.name) this.error('Workflow name or ID required')
        await this.exportWorkflow(args.name, flags)
        break
      case 'import':
        await this.importWorkflow(flags)
        break
      default:
        this.error(`Unknown action: ${args.action}`)
    }
  }

  private async showInteractiveMenu(flags: any): Promise<void> {
    const workflows = await this.storage.list()
    
    if (workflows.length === 0) {
      this.log('No workflows saved yet.')
      this.log('\nCreate workflows using: chromancer claude "your instruction"')
      return
    }

    const choices = [
      ...workflows.map(w => ({
        name: `${w.name} ${chalk.gray(`(${w.tags?.join(', ') || 'no tags'}) - ${w.executions || 0} runs`)}`,
        value: { action: 'run', workflow: w }
      })),
      new inquirer.Separator(),
      { name: '📋 List all workflows', value: { action: 'list' } },
      { name: '📥 Import workflow', value: { action: 'import' } },
      { name: '🚪 Exit', value: { action: 'exit' } }
    ]

    const { selection } = await inquirer.prompt([{
      type: 'list',
      name: 'selection',
      message: 'Select a workflow to run or an action:',
      choices
    }])

    switch (selection.action) {
      case 'run':
        await this.runWorkflow(selection.workflow.id, flags)
        break
      case 'list':
        await this.listWorkflows(flags)
        break
      case 'import':
        await this.importWorkflow(flags)
        break
      case 'exit':
        break
    }
  }

  private async listWorkflows(flags: any): Promise<void> {
    const filter: { tags?: string[] } = {}
    
    if (flags.tags) {
      filter.tags = flags.tags.split(',').map((t: string) => t.trim())
    }

    const workflows = await this.storage.list(filter)
    
    if (workflows.length === 0) {
      this.log('No workflows found.')
      return
    }

    this.log(chalk.bold('\n📚 Saved Workflows:\n'))
    
    for (const workflow of workflows) {
      this.log(chalk.green(`▸ ${workflow.name}`))
      if (workflow.description) {
        this.log(chalk.gray(`  ${workflow.description}`))
      }
      this.log(chalk.gray(`  ID: ${workflow.id}`))
      this.log(chalk.gray(`  Created: ${new Date(workflow.createdAt).toLocaleString()}`))
      if (workflow.tags && workflow.tags.length > 0) {
        this.log(chalk.gray(`  Tags: ${workflow.tags.join(', ')}`))
      }
      if (workflow.executions) {
        this.log(chalk.gray(`  Executions: ${workflow.executions}`))
      }
      this.log('')
    }
  }

  private async runWorkflow(nameOrId: string, flags: any): Promise<void> {
    try {
      const workflow = await this.storage.load(nameOrId)
      
      this.log(chalk.cyan(`\n🚀 Running workflow: ${workflow.name}\n`))
      
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

      // Parse and execute workflow
      const workflowSteps = yaml.parse(workflow.yaml)
      const executor = new WorkflowExecutor(this.page!)
      const result = await executor.execute(workflowSteps, {
        strict: true,
        captureOutput: flags.verbose
      })

      // Show results
      this.log(chalk.cyan('\n📊 Execution Summary:'))
      this.log(`   Total steps: ${result.totalSteps}`)
      this.log(`   ${chalk.green('✅ Successful:')} ${result.successfulSteps}`)
      if (result.failedSteps > 0) {
        this.log(`   ${chalk.red('❌ Failed:')} ${result.failedSteps}`)
      }
      this.log(`   ⏱️  Duration: ${result.totalDuration}ms`)

      // Record execution
      await this.storage.recordExecution(workflow.id)

      if (result.success) {
        this.log(chalk.green('\n✅ Workflow completed successfully!'))
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Failed to run workflow: ${errorMessage}`)
    }
  }

  private async showWorkflow(nameOrId: string): Promise<void> {
    try {
      const workflow = await this.storage.load(nameOrId)
      
      this.log(chalk.bold(`\n📄 Workflow: ${workflow.name}\n`))
      
      if (workflow.description) {
        this.log(`Description: ${workflow.description}`)
      }
      
      this.log(`\nOriginal prompt: "${workflow.prompt}"`)
      this.log(`Created: ${new Date(workflow.createdAt).toLocaleString()}`)
      this.log(`Updated: ${new Date(workflow.updatedAt).toLocaleString()}`)
      
      if (workflow.tags && workflow.tags.length > 0) {
        this.log(`Tags: ${workflow.tags.join(', ')}`)
      }
      
      this.log(`Executions: ${workflow.executions || 0}`)
      
      if (workflow.lastExecuted) {
        this.log(`Last executed: ${new Date(workflow.lastExecuted).toLocaleString()}`)
      }
      
      this.log(chalk.cyan('\nWorkflow YAML:'))
      this.log('---')
      this.log(workflow.yaml)
      this.log('---')
      
      if (workflow.versions && workflow.versions.length > 1) {
        this.log(chalk.yellow(`\n📝 Version History (${workflow.versions.length} versions):`))
        workflow.versions.forEach((v, i) => {
          this.log(`  v${v.version} - ${new Date(v.createdAt).toLocaleString()} - ${v.reason}`)
        })
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Failed to show workflow: ${errorMessage}`)
    }
  }

  private async deleteWorkflow(nameOrId: string): Promise<void> {
    try {
      const workflow = await this.storage.load(nameOrId)
      
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete "${workflow.name}"?`,
        default: false
      }])

      if (!confirm) {
        this.log('Deletion cancelled.')
        return
      }

      await this.storage.delete(workflow.id)
      this.log(chalk.green(`✅ Workflow "${workflow.name}" deleted.`))
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Failed to delete workflow: ${errorMessage}`)
    }
  }

  private async exportWorkflow(nameOrId: string, flags: any): Promise<void> {
    try {
      const workflow = await this.storage.load(nameOrId)
      const outputFile = flags.output || `${workflow.name.replace(/\s+/g, '-')}.yml`
      
      await fs.writeFile(outputFile, workflow.yaml)
      
      this.log(chalk.green(`✅ Workflow exported to: ${outputFile}`))
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Failed to export workflow: ${errorMessage}`)
    }
  }

  private async importWorkflow(flags: any): Promise<void> {
    const file = flags.file || await this.promptForFile()
    
    try {
      const yamlContent = await fs.readFile(file, 'utf-8')
      
      // Validate YAML
      const parsed = yaml.parse(yamlContent)
      if (!Array.isArray(parsed)) {
        this.error('Invalid workflow: must be an array of steps')
      }

      // Prompt for workflow details
      const { name, description, tags, prompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Workflow name:',
          validate: (input) => input.length > 0 || 'Name is required'
        },
        {
          type: 'input',
          name: 'prompt',
          message: 'Original instruction/prompt:',
          default: 'Imported workflow'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description (optional):'
        },
        {
          type: 'input',
          name: 'tags',
          message: 'Tags (comma-separated, optional):'
        }
      ])

      const tagArray = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined
      
      const saved = await this.storage.save(name, prompt, yamlContent, description, tagArray)
      
      this.log(chalk.green(`\n✅ Workflow imported: ${saved.name} (${saved.id})`))
      this.log(`📁 Location: ~/.chromancer/workflows/${saved.id}.json`)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Failed to import workflow: ${errorMessage}`)
    }
  }

  private async promptForFile(): Promise<string> {
    const { file } = await inquirer.prompt([{
      type: 'input',
      name: 'file',
      message: 'Path to YAML workflow file:',
      validate: async (input) => {
        try {
          await fs.access(input)
          return true
        } catch {
          return 'File not found'
        }
      }
    }])
    
    return file
  }
}