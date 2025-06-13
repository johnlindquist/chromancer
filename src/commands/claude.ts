import { Args, Flags } from "@oclif/core"
import { BaseCommand } from "../base.js"
import { askClaude } from "../utils/claude.js"
import { WorkflowExecutor } from "../utils/workflow-executor.js"
import { WorkflowStorage } from "../utils/workflow-storage.js"
import * as yaml from "yaml"
import inquirer from "inquirer"
import type { WorkflowExecutionResult } from "../types/workflow.js"

interface WorkflowAttempt {
  prompt: string
  yaml: string
  result?: WorkflowExecutionResult
  claudeAnalysis?: string
}

export default class Claude extends BaseCommand {
  static description =
    "Natural-language agent powered by Claude - turns English into Chromancer workflows with intelligent feedback loop"

  static examples = [
    '<%= config.bin %> <%= command.id %> "Click the login button and wait for #dashboard"',
    '<%= config.bin %> <%= command.id %> --dry-run "Scroll to 80% of the page"',
    '<%= config.bin %> <%= command.id %> --no-interactive "Take a screenshot" # Skip feedback loop',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    "dry-run": Flags.boolean({
      char: "d",
      description: "Show generated workflow but do NOT execute it",
      default: false,
    }),
    interactive: Flags.boolean({
      description: "Enable interactive feedback loop after execution",
      default: true,
      allowNo: true,
    }),
    "max-attempts": Flags.integer({
      description: "Maximum autofix attempts",
      default: 3,
    }),
  }

  static args = {
    instruction: Args.string({
      description: "English instruction for Claude",
      required: true,
    }),
  }

  private storage = new WorkflowStorage()
  private attempts: WorkflowAttempt[] = []

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Claude)

    // Initial attempt
    await this.attemptWorkflow(args.instruction, flags)
  }

  private async attemptWorkflow(instruction: string, flags: any, previousAttempts?: WorkflowAttempt[]): Promise<void> {
    // Build system prompt with context from previous attempts
    const systemPrompt = this.buildSystemPrompt(previousAttempts)
    const fullPrompt = `${systemPrompt}\n\nUser instruction: ${instruction}`

    this.log("🤖 Asking Claude...")
    
    try {
      const raw = await askClaude(fullPrompt)
      const yamlText = this.cleanYamlOutput(raw)
      
      // Validate YAML
      this.validateYaml(yamlText)

      if (flags["dry-run"] || flags.verbose) {
        this.log("\n--- GENERATED WORKFLOW ---\n")
        this.log(yamlText)
        this.log("\n--------------------------\n")
      }

      if (flags["dry-run"]) return

      // Execute workflow
      const result = await this.executeWorkflow(yamlText, flags)
      
      // Store this attempt
      const attempt: WorkflowAttempt = {
        prompt: instruction,
        yaml: yamlText,
        result
      }
      this.attempts.push(attempt)

      // Show execution summary
      this.showExecutionSummary(result)

      // If interactive mode and workflow had issues, enter feedback loop
      if (flags.interactive && (!result.success || result.failedSteps > 0)) {
        await this.handleFeedbackLoop(instruction, attempt, flags)
      } else if (flags.interactive && result.success) {
        // Offer to save successful workflow
        await this.promptSaveWorkflow(instruction, yamlText)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Error: ${errorMessage}`)
    }
  }

  private buildSystemPrompt(previousAttempts?: WorkflowAttempt[]): string {
    let prompt = `You are an expert Chromancer automation engineer. Convert the user's natural language instruction into a valid YAML workflow.

OUTPUT RULES:
1. Return ONLY valid YAML - no markdown, no explanations, no comments
2. Start immediately with a dash (-) character
3. Use array format with one command per step
4. Each step must be a single key-value pair
5. Use proper YAML indentation (2 spaces)
6. DO NOT include any text before or after the YAML

AVAILABLE COMMANDS:
- navigate/goto: Visit a URL
- click: Click an element (selector or {selector, button, clickCount})
- type: Type text ({selector, text} or "selector text")
- wait: Wait for element/URL ({selector, timeout} or {url, timeout})
- screenshot: Take screenshot (filename or {path, fullPage})
- scroll: Scroll page ({to: percentage} or {selector})
- evaluate: Run JavaScript ({script} or script string)
- hover: Hover over element (selector)
- select: Select dropdown option ({selector, value/label/index})
- fill: Fill form field ({selector, value})
- assert: Assert condition ({selector, text/value/visible})
- store: Store value in variable ({selector, variable})

IMPORTANT: Your output must be valid YAML that starts with a dash (-) for each step.`

    // Add context from previous attempts
    if (previousAttempts && previousAttempts.length > 0) {
      prompt += "\n\nPREVIOUS ATTEMPTS AND RESULTS:"
      
      previousAttempts.forEach((attempt, index) => {
        prompt += `\n\nAttempt ${index + 1}:\n`
        prompt += `YAML:\n${attempt.yaml}\n`
        
        if (attempt.result) {
          prompt += WorkflowExecutor.formatResultsForAnalysis(
            attempt.result,
            attempt.prompt,
            attempt.yaml
          )
        }
        
        if (attempt.claudeAnalysis) {
          prompt += `\nAnalysis: ${attempt.claudeAnalysis}`
        }
      })

      prompt += "\n\nBased on the previous attempts, generate an improved workflow that addresses the issues."
    }

    return prompt
  }

  private cleanYamlOutput(raw: string): string {
    // First, try to extract YAML if it's wrapped in backticks
    let cleaned = raw
      .replace(/```ya?ml/gi, "")
      .replace(/```/g, "")
      .trim()
    
    // Find where the YAML actually starts (first line starting with -)
    const lines = cleaned.split('\n')
    const yamlStartIndex = lines.findIndex(line => line.trim().startsWith('-'))
    
    if (yamlStartIndex > 0) {
      // Remove any text before the YAML
      cleaned = lines.slice(yamlStartIndex).join('\n')
    }
    
    // Remove any text after the YAML ends
    const yamlLines: string[] = []
    let inYaml = false
    
    for (const line of cleaned.split('\n')) {
      if (line.trim().startsWith('-')) {
        inYaml = true
      }
      
      if (inYaml) {
        // Stop if we hit a line that's not indented and doesn't start with -
        if (line.trim() && !line.startsWith(' ') && !line.trim().startsWith('-')) {
          break
        }
        yamlLines.push(line)
      }
    }
    
    return yamlLines.join('\n').trim()
  }

  private validateYaml(yamlText: string): void {
    try {
      const parsed = yaml.parse(yamlText)
      if (!Array.isArray(parsed)) {
        throw new Error("Workflow must be an array of steps")
      }
      
      parsed.forEach((step, index) => {
        if (typeof step !== 'object' || step === null) {
          throw new Error(`Step ${index + 1} must be an object`)
        }
        const commands = Object.keys(step)
        if (commands.length === 0) {
          throw new Error(`Step ${index + 1} must contain a command`)
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Invalid YAML generated: ${errorMessage}\n\nGenerated content:\n${yamlText}`)
    }
  }

  private async executeWorkflow(yamlText: string, flags: any): Promise<WorkflowExecutionResult> {
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

    // Parse workflow
    const workflow = yaml.parse(yamlText)
    
    // Execute with WorkflowExecutor
    const executor = new WorkflowExecutor(this.page!)
    const result = await executor.execute(workflow, {
      strict: false, // Don't stop on errors, we want to see all results
      captureOutput: true
    })

    return result
  }

  private showExecutionSummary(result: WorkflowExecutionResult): void {
    this.log("\n📊 Execution Summary:")
    this.log(`   Total steps: ${result.totalSteps}`)
    this.log(`   ✅ Successful: ${result.successfulSteps}`)
    this.log(`   ❌ Failed: ${result.failedSteps}`)
    this.log(`   ⏱️  Duration: ${result.totalDuration}ms`)
    
    if (result.failedSteps > 0) {
      this.log("\n❌ Failed steps:")
      result.steps.filter(step => !step.success).forEach(step => {
        this.log(`   Step ${step.stepNumber} (${step.command}): ${step.error}`)
      })
    }
  }

  private async handleFeedbackLoop(
    originalInstruction: string,
    lastAttempt: WorkflowAttempt,
    flags: any
  ): Promise<void> {
    // Get Claude's analysis of what went wrong
    const analysisPrompt = WorkflowExecutor.formatResultsForAnalysis(
      lastAttempt.result!,
      originalInstruction,
      lastAttempt.yaml
    ) + "\n\nProvide a brief analysis of what went wrong and what should be changed."

    this.log("\n🔍 Analyzing results...")
    const analysis = await askClaude(analysisPrompt)
    lastAttempt.claudeAnalysis = analysis

    this.log("\n💡 Claude's analysis:")
    this.log(analysis)

    // Show options to user
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🔧 Autofix - Let Claude try again', value: 'autofix' },
        { name: '✏️  Modify - Edit the instruction', value: 'modify' },
        { name: '💾 Save - Save current workflow as-is', value: 'save' },
        { name: '🚪 Quit - Exit without saving', value: 'quit' }
      ]
    }])

    switch (action) {
      case 'autofix':
        if (this.attempts.length >= flags["max-attempts"]) {
          this.warn(`Maximum attempts (${flags["max-attempts"]}) reached.`)
          await this.promptSaveWorkflow(originalInstruction, lastAttempt.yaml)
        } else {
          this.log(`\n🔄 Attempt ${this.attempts.length + 1} of ${flags["max-attempts"]}...`)
          await this.attemptWorkflow(originalInstruction, flags, this.attempts)
        }
        break

      case 'modify':
        const { newInstruction } = await inquirer.prompt([{
          type: 'input',
          name: 'newInstruction',
          message: 'Enter modified instruction:',
          default: originalInstruction
        }])
        
        // Reset attempts for new instruction
        this.attempts = []
        await this.attemptWorkflow(newInstruction, flags)
        break

      case 'save':
        await this.promptSaveWorkflow(originalInstruction, lastAttempt.yaml)
        break

      case 'quit':
        this.log('👋 Exiting without saving.')
        break
    }
  }

  private async promptSaveWorkflow(instruction: string, yamlText: string): Promise<void> {
    const { shouldSave } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldSave',
      message: 'Would you like to save this workflow?',
      default: true
    }])

    if (!shouldSave) return

    const { name, description, tags } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Workflow name:',
        validate: (input) => input.length > 0 || 'Name is required'
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

    try {
      const saved = await this.storage.save(name, instruction, yamlText, description, tagArray)
      this.log(`\n✅ Workflow saved: ${saved.name} (${saved.id})`)
      this.log(`📁 Location: ~/.chromancer/workflows/${saved.id}.json`)
      this.log(`\n💡 Run it later with: chromancer workflows run "${name}"`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Failed to save workflow: ${errorMessage}`)
    }
  }
}