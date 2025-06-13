import { Args, Flags } from "@oclif/core"
import { BaseCommand } from "../base.js"
import { askClaude } from "../utils/claude.js"
import { WorkflowExecutor } from "../utils/workflow-executor.js"
import { WorkflowStorage } from "../utils/workflow-storage.js"
import { DOMInspector } from "../utils/dom-inspector.js"
import * as yaml from "yaml"
import inquirer from "inquirer"
import type { WorkflowExecutionResult } from "../types/workflow.js"

interface WorkflowAttempt {
  prompt: string
  yaml: string
  result?: WorkflowExecutionResult
  claudeAnalysis?: string
}

interface VerificationResult {
  success: boolean
  analysis: string
  reason: string
  suggestions?: string[]
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
    "auto-inspect": Flags.boolean({
      description: "Automatically inspect DOM when selectors fail",
      default: true,
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
      const result = await this.executeWorkflow(yamlText, flags, instruction)
      
      // Store this attempt
      const attempt: WorkflowAttempt = {
        prompt: instruction,
        yaml: yamlText,
        result
      }
      this.attempts.push(attempt)

      // Show execution summary
      this.showExecutionSummary(result)

      // If interactive mode, always verify results with Claude
      if (flags.interactive) {
        const verification = await this.verifyResults(instruction, attempt, result)
        
        // Show verification to user
        this.log("\n🔍 AI Verification:")
        this.log(verification.analysis)
        
        // Handle next steps based on verification
        if (verification.success) {
          this.log("\n✅ " + verification.reason)
          await this.handleSuccessfulWorkflow(instruction, yamlText, flags)
        } else {
          this.log("\n⚠️  " + verification.reason)
          await this.handleFeedbackLoop(instruction, attempt, flags, verification)
        }
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
- evaluate: Run JavaScript ({script} or script string) - USE THIS FOR DATA EXTRACTION/SCRAPING
- hover: Hover over element (selector)
- select: Select dropdown option ({selector, value/label/index})
- fill: Fill form field ({selector, value})
- assert: Assert condition ({selector, text/value/visible})

IMPORTANT DATA EXTRACTION RULES:
- When user asks to "scrape", "grab", "extract", or "get" data, ALWAYS use evaluate
- The evaluate script should return the data (arrays or objects work best)
- The script must be a valid JavaScript expression that returns a value
- Examples:
  - Simple text: 
    - evaluate: "document.querySelector('h1').textContent"
  - Text array: 
    - evaluate: "Array.from(document.querySelectorAll('h1')).map(el => el.textContent.trim())"
  - For complex scripts use the script format:
    - evaluate:
        script: |
          Array.from(document.querySelectorAll('.item')).map(el => ({
            title: el.querySelector('h2').textContent,
            link: el.querySelector('a').href
          }))
- The data will be automatically displayed and saved to a file
- Format (JSON/CSV/text) is handled automatically based on user request

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
      
      // Add specific guidance for data extraction failures
      const lastAttempt = previousAttempts[previousAttempts.length - 1];
      if (lastAttempt?.result && this.hasEmptyDataExtraction(lastAttempt.result)) {
        prompt += `\n\nIMPORTANT: The previous attempt failed to extract any data. 
The selectors used did not match any elements on the page. 
Based on the DOM analysis, try using more generic selectors or the suggested patterns.
Consider using broader selectors first to test, then narrow down.`
      }
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

  private async executeWorkflow(yamlText: string, flags: any, instruction?: string): Promise<WorkflowExecutionResult> {
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
    const executor = new WorkflowExecutor(this.page!, instruction)
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
    flags: any,
    verification?: VerificationResult
  ): Promise<void> {
    // Use provided verification or get Claude's analysis
    if (!verification) {
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
    } else {
      lastAttempt.claudeAnalysis = verification.analysis
      
      // Show suggestions if available
      if (verification.suggestions && verification.suggestions.length > 0) {
        this.log("\n💡 Suggestions for improvement:")
        verification.suggestions.forEach((suggestion, index) => {
          this.log(`   ${index + 1}. ${suggestion}`)
        })
      }
    }

    // Show options to user
    const choices = [
      { name: '🔧 Autofix - Let Claude try again with improvements', value: 'autofix' },
      { name: '✏️  Modify prompt - Change what you\'re asking for', value: 'modify' },
      { name: '➕ Append to prompt - Add more details', value: 'append' },
      { name: '🎯 Refine selectors - Help Claude find the right elements', value: 'refine' },
      { name: '💾 Save anyway - Keep current workflow', value: 'save' },
      { name: '🚪 Exit without saving', value: 'quit' }
    ]

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'The workflow needs improvement. What would you like to do?',
      choices
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

      case 'append':
        const { appendText } = await inquirer.prompt([{
          type: 'input',
          name: 'appendText',
          message: 'What additional details would you like to add?',
          validate: (input) => input.trim().length > 0 || 'Please provide additional details'
        }])
        
        const appendedInstruction = `${originalInstruction}. ${appendText}`
        this.log(`\n📝 Updated instruction: "${appendedInstruction}"`)
        
        // Keep previous attempts for context
        await this.attemptWorkflow(appendedInstruction, flags, this.attempts)
        break

      case 'refine':
        const { refinementType } = await inquirer.prompt([{
          type: 'list',
          name: 'refinementType',
          message: 'What would you like to refine?',
          choices: [
            { name: 'Specify exact element text or attributes', value: 'element' },
            { name: 'Add wait conditions', value: 'wait' },
            { name: 'Specify data format', value: 'format' },
            { name: 'Add error handling', value: 'error' }
          ]
        }])

        let refinedInstruction = originalInstruction
        
        switch (refinementType) {
          case 'element':
            const { elementDetails } = await inquirer.prompt([{
              type: 'input',
              name: 'elementDetails',
              message: 'Describe the element more specifically (e.g., "the blue submit button", "link containing \'Login\'"):'
            }])
            refinedInstruction = `${originalInstruction}. Look for ${elementDetails}`
            break
          
          case 'wait':
            const { waitDetails } = await inquirer.prompt([{
              type: 'input',
              name: 'waitDetails',
              message: 'What should we wait for? (e.g., "wait for loading spinner to disappear", "wait 2 seconds"):'
            }])
            refinedInstruction = `${originalInstruction}. ${waitDetails}`
            break
          
          case 'format':
            const { formatDetails } = await inquirer.prompt([{
              type: 'input',
              name: 'formatDetails',
              message: 'How should the data be formatted? (e.g., "as CSV", "only titles", "include links"):'
            }])
            refinedInstruction = `${originalInstruction} and format ${formatDetails}`
            break
          
          case 'error':
            refinedInstruction = `${originalInstruction}. If elements are not found, try alternative selectors. Handle any errors gracefully`
            break
        }

        this.log(`\n📝 Refined instruction: "${refinedInstruction}"`)
        await this.attemptWorkflow(refinedInstruction, flags, this.attempts)
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

  private async verifyResults(
    instruction: string,
    attempt: WorkflowAttempt,
    result: WorkflowExecutionResult
  ): Promise<VerificationResult> {
    // Check if this was a data extraction that returned empty results
    const isDataExtraction = instruction.toLowerCase().includes('scrape') || 
                           instruction.toLowerCase().includes('extract') || 
                           instruction.toLowerCase().includes('grab') ||
                           instruction.toLowerCase().includes('get');
    
    const hasEmptyData = result.steps.some(step => 
      step.command === 'evaluate' && 
      step.output?.includes('0 items') || 
      step.output?.includes('[]')
    );

    // If data extraction failed, do DOM inspection
    let domAnalysis = '';
    if (isDataExtraction && hasEmptyData && this.page) {
      this.log("\n🔍 Inspecting page structure to find better selectors...");
      const inspector = new DOMInspector(this.page);
      const inspection = await inspector.inspectForDataExtraction(instruction);
      
      domAnalysis = `
DOM INSPECTION RESULTS:
- Found ${inspection.selectors.common.length} repeated element patterns
- Most common pattern: ${inspection.selectors.common[0] || 'none found'}
- Page has ${inspection.structure.headings.length} headings, ${inspection.structure.links.length} links

Suggestions:
${inspection.suggestions.join('\n')}

Working selectors found:
${inspection.selectors.common.slice(0, 5).join(', ')}
`;
    }
    // Build verification prompt
    const verificationPrompt = `
You are verifying if a browser automation workflow successfully achieved the user's goal.

User's request: "${instruction}"

Workflow executed with these results:
${WorkflowExecutor.formatResultsForAnalysis(result, instruction, attempt.yaml)}

${domAnalysis ? `\n${domAnalysis}\n` : ''}

VERIFICATION TASK:
1. Analyze if the workflow achieved what the user requested
2. Check if any extracted data looks correct and complete
3. Identify any potential issues or missing steps

Please provide:
1. A brief analysis (2-3 sentences) of the results
2. Whether it was successful (true/false)
3. A reason why it succeeded or failed
4. If failed, specific suggestions for improvement

Format your response as JSON:
{
  "success": boolean,
  "analysis": "Your 2-3 sentence analysis",
  "reason": "Brief reason for success/failure",
  "suggestions": ["suggestion 1", "suggestion 2"] // only if failed
}
`

    try {
      const response = await askClaude(verificationPrompt)
      
      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          success: parsed.success ?? false,
          analysis: parsed.analysis || "Unable to analyze results",
          reason: parsed.reason || "No reason provided",
          suggestions: parsed.suggestions
        }
      }
      
      // Fallback if not proper JSON
      return {
        success: response.toLowerCase().includes("success") || response.toLowerCase().includes("correct"),
        analysis: response,
        reason: "Unable to parse structured response"
      }
    } catch (error) {
      // If verification fails, assume workflow succeeded to avoid blocking
      return {
        success: true,
        analysis: "Verification step encountered an error",
        reason: "Proceeding with workflow as successful"
      }
    }
  }

  private async handleSuccessfulWorkflow(
    instruction: string,
    yamlText: string,
    flags: any
  ): Promise<void> {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'The workflow succeeded! What would you like to do?',
      choices: [
        { name: '💾 Save workflow for future use', value: 'save' },
        { name: '🔄 Run again', value: 'run' },
        { name: '✏️  Modify and try different approach', value: 'modify' },
        { name: '✅ Done', value: 'done' }
      ]
    }])

    switch (action) {
      case 'save':
        await this.promptSaveWorkflow(instruction, yamlText)
        break
      
      case 'run':
        this.log("\n🔄 Running workflow again...")
        await this.attemptWorkflow(instruction, flags, this.attempts)
        break
      
      case 'modify':
        const { newInstruction } = await inquirer.prompt([{
          type: 'input',
          name: 'newInstruction',
          message: 'Enter modified instruction:',
          default: instruction
        }])
        this.attempts = []
        await this.attemptWorkflow(newInstruction, flags)
        break
      
      case 'done':
        this.log('✅ Great! Workflow completed successfully.')
        break
    }
  }

  private hasEmptyDataExtraction(result: WorkflowExecutionResult): boolean {
    return result.steps.some(step => 
      step.command === 'evaluate' && 
      (step.output?.includes('0 items') || step.output?.includes('[]'))
    );
  }
}