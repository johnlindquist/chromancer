import { Args, Flags } from "@oclif/core"
import { BaseCommand } from "../base.js"
import { askClaude } from "../utils/claude.js"
import { WorkflowExecutor } from "../utils/workflow-executor.js"
import { WorkflowStorage } from "../utils/workflow-storage.js"
import { DOMInspector } from "../utils/dom-inspector.js"
import { RunLogManager } from "../utils/run-log.js"
import { DOMDigestCollector } from "../utils/dom-digest.js"
import * as yaml from "yaml"
import inquirer from "inquirer"
import type { WorkflowExecutionResult } from "../types/workflow.js"

interface WorkflowAttempt {
  prompt: string
  yaml: string
  result?: WorkflowExecutionResult
  claudeAnalysis?: string
  runLogId?: string
}

interface VerificationResult {
  success: boolean
  analysis: string
  reason: string
  suggestions?: string[]
}

export default class AI extends BaseCommand {
  private runLogManager: RunLogManager
  private digestCollector?: DOMDigestCollector

  static description =
    "Natural-language AI assistant - turns English instructions into browser automation workflows"

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

  constructor(argv: string[], config: any) {
    super(argv, config)
    this.runLogManager = new RunLogManager()
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AI)

    // Initial attempt
    await this.attemptWorkflow(args.instruction, flags)
  }

  private async attemptWorkflow(instruction: string, flags: any, previousAttempts?: WorkflowAttempt[]): Promise<void> {
    // Collect DOM digest if we're already connected and have failures
    let domDigest: string | undefined
    if (this.page && previousAttempts && previousAttempts.length > 0) {
      const lastAttempt = previousAttempts[previousAttempts.length - 1]
      if (lastAttempt.result && this.hasEmptyDataExtraction(lastAttempt.result)) {
        try {
          if (!this.digestCollector) {
            this.digestCollector = new DOMDigestCollector(this.page)
          }
          const digest = await this.digestCollector.collect()
          domDigest = this.digestCollector.formatForClaude(digest)
        } catch (error) {
          // Ignore digest collection errors
        }
      }
    }

    // Build system prompt with context from previous attempts
    const systemPrompt = this.buildSystemPrompt(previousAttempts, domDigest)

    // Structure the instruction based on whether this is a retry
    let structuredInstruction = ''
    if (previousAttempts && previousAttempts.length > 0) {
      // Extract original instruction from the first attempt
      const originalInstruction = previousAttempts[0].prompt

      // Check if current instruction is different (has been appended/modified)
      if (instruction !== originalInstruction) {
        // Extract the follow-up part
        const followUpPart = instruction.replace(originalInstruction, '').replace(/^[.\s]+/, '')

        structuredInstruction = `<original-instruction>
${originalInstruction}
</original-instruction>

<follow-up-instruction>
${followUpPart}
</follow-up-instruction>

Note: The original instruction failed. The user has provided additional clarification above.`
      } else {
        structuredInstruction = `User instruction: ${instruction}`
      }
    } else {
      structuredInstruction = `User instruction: ${instruction}`
    }

    const fullPrompt = `${systemPrompt}\n\n${structuredInstruction}`

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

  private buildSystemPrompt(previousAttempts?: WorkflowAttempt[], domDigest?: string): string {
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

SEARCH RESULT EXTRACTION TIPS:
- Google search results are typically in '.g' containers
- News articles often have dates/timestamps and source names
- Skip "People also ask" boxes and featured snippets at the top
- For news articles specifically, look for:
  - Elements containing dates (e.g., "2 hours ago", "Dec 13")
  - Elements with news source names (CNN, BBC, etc.)
  - h3 tags within search result containers
- Bio/profile links (Wikipedia, social media) usually appear at the top
- To get actual search results, skip the first few elements if they're profiles

IMPORTANT: Your output must be valid YAML that starts with a dash (-) for each step.

INSTRUCTION HANDLING:
- If you receive <original-instruction> and <follow-up-instruction> tags, this means:
  - The original instruction was attempted but failed or was incomplete
  - The user has provided additional clarification in the follow-up
  - You should consider BOTH parts to understand the full intent
  - Focus on addressing what was missing or unclear from the first attempt`

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
The selectors used did not match any elements on the page.`

        if (domDigest) {
          prompt += `\n\nCURRENT PAGE STRUCTURE:\n${domDigest}\n\nUse the patterns shown above to create working selectors.`
        } else {
          prompt += `\nBased on the DOM analysis, try using more generic selectors or the suggested patterns.
Consider using broader selectors first to test, then narrow down.`
        }
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
    // Try to connect to Chrome, auto-launch if needed
    try {
      await this.connectToChrome(
        flags.port,
        flags.host,
        flags.launch,
        flags.profile,
        flags.headless,
        flags.verbose,
        flags.keepOpen
      )
    } catch (error) {
      // If connection failed and launch wasn't already true, try auto-launching
      if (!flags.launch) {
        this.log('🚀 No Chrome instance found. Auto-launching Chrome...')
        await this.connectToChrome(
          flags.port,
          flags.host,
          true, // Force launch
          flags.profile,
          flags.headless,
          flags.verbose,
          flags.keepOpen
        )
      } else {
        throw error
      }
    }

    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    // Initialize digest collector if needed
    if (!this.digestCollector) {
      this.digestCollector = new DOMDigestCollector(this.page!)
    }

    // Parse workflow
    const workflow = yaml.parse(yamlText)

    // Execute with WorkflowExecutor
    const executor = new WorkflowExecutor(this.page!, instruction)
    const result = await executor.execute(workflow, {
      strict: false, // Don't stop on errors, we want to see all results
      captureOutput: true
    })

    // Create run log
    try {
      await this.runLogManager.init()
      const currentUrl = await this.page!.url()
      const digest = await this.digestCollector.collect()

      const runLog = await this.runLogManager.createRunLog(result, {
        url: currentUrl,
        domDigest: digest
      })

      // Store run log ID in the current attempt
      if (this.attempts.length > 0) {
        this.attempts[this.attempts.length - 1].runLogId = runLog.id
      }
    } catch (error) {
      // Log creation failure shouldn't break the workflow
      if (flags.verbose) {
        this.warn(`Failed to create run log: ${error}`)
      }
    }

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

    // Build menu choices with suggestions as first options
    const choices = []
    
    // Add suggestion-based choices first
    if (verification && verification.suggestions && verification.suggestions.length > 0) {
      verification.suggestions.slice(0, 3).forEach((suggestion, index) => {
        choices.push({
          name: `💡 ${index + 1}. ${suggestion}`,
          value: `suggestion_${index}`
        })
      })
      choices.push({ name: '─────────────────', value: 'separator', disabled: true })
    }
    
    // Add standard choices
    choices.push(
      { name: '🔧 Autofix - Let Claude try again with improvements', value: 'autofix' },
      { name: '✏️ Modify prompt - Change what you\'re asking for', value: 'modify' },
      { name: '🔄 Refine with feedback - Correct the results', value: 'refine-feedback' },
      { name: '🎯 Refine selectors - Help Claude find the right elements', value: 'refine' },
      { name: '💾 Save anyway - Keep current workflow', value: 'save' },
      { name: '🚪 Exit without saving', value: 'quit' }
    )

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'The workflow needs improvement. What would you like to do?',
      choices
    }])

    // Handle suggestion selections
    if (action.startsWith('suggestion_')) {
      const suggestionIndex = parseInt(action.split('_')[1])
      const suggestion = verification!.suggestions![suggestionIndex]
      
      const appendedInstruction = `${originalInstruction}. ${suggestion}`
      this.log(`\n📝 Applying suggestion: "${suggestion}"`)
      this.log(`Updated instruction: "${appendedInstruction}"`)
      
      // Keep previous attempts for context
      await this.attemptWorkflow(appendedInstruction, flags, this.attempts)
      return
    }

    switch (action) {
      case 'autofix':
        this.log(`\n🔄 Attempt ${this.attempts.length + 1}...`)
        await this.attemptWorkflow(originalInstruction, flags, this.attempts)
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

      case 'refine-feedback':
        this.log(`\n📜 Original instruction: "${originalInstruction}"`)
        this.log(`\n📊 Previous result:`)
        
        // Show the output from the last attempt
        if (lastAttempt.result) {
          const resultSummary = this.formatResultForFeedback(lastAttempt.result)
          this.log(resultSummary)
        }
        
        const { feedbackText } = await inquirer.prompt([{
          type: 'input',
          name: 'feedbackText',
          message: 'What needs to be corrected or improved?',
          validate: (input) => input.trim().length > 0 || 'Please provide your feedback'
        }])

        // Create a structured refinement that includes the output
        const refinedInstruction = this.createRefinedInstruction(
          originalInstruction,
          lastAttempt.result,
          feedbackText
        )
        
        this.log(`\n📝 Refining with your feedback...`)

        // Keep previous attempts for context
        await this.attemptWorkflow(refinedInstruction, flags, this.attempts)
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

        let refinedSelectorInstruction = originalInstruction

        switch (refinementType) {
          case 'element':
            const { elementDetails } = await inquirer.prompt([{
              type: 'input',
              name: 'elementDetails',
              message: 'Describe the element more specifically (e.g., "the blue submit button", "link containing \'Login\'"):'
            }])
            refinedSelectorInstruction = `${originalInstruction}. Look for ${elementDetails}`
            break

          case 'wait':
            const { waitDetails } = await inquirer.prompt([{
              type: 'input',
              name: 'waitDetails',
              message: 'What should we wait for? (e.g., "wait for loading spinner to disappear", "wait 2 seconds"):'
            }])
            refinedSelectorInstruction = `${originalInstruction}. ${waitDetails}`
            break

          case 'format':
            const { formatDetails } = await inquirer.prompt([{
              type: 'input',
              name: 'formatDetails',
              message: 'How should the data be formatted? (e.g., "as CSV", "only titles", "include links"):'
            }])
            refinedSelectorInstruction = `${originalInstruction} and format ${formatDetails}`
            break

          case 'error':
            refinedSelectorInstruction = `${originalInstruction}. If elements are not found, try alternative selectors. Handle any errors gracefully`
            break
        }

        this.log(`\n📝 Refined instruction: "${refinedSelectorInstruction}"`)
        await this.attemptWorkflow(refinedSelectorInstruction, flags, this.attempts)
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

    if (!shouldSave) {
      this.log('✅ Workflow completed without saving.')
      return
    }

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
      const inspection = await inspector.inspectWithDigest(instruction);

      // Format digest for Claude if available
      let digestInfo = '';
      if (inspection.digest) {
        digestInfo = `
URL: ${inspection.digest.url}
Title: ${inspection.digest.title}

Top Patterns (by frequency):
${inspection.digest.patterns.slice(0, 10).map(p => `  ${p.selector} (${p.count} elements)`).join('\n')}

Sample Text Content:
${inspection.digest.texts.slice(0, 10).map(t => `  "${t}"`).join('\n')}
`;
      }

      domAnalysis = `
DOM INSPECTION RESULTS:
- Found ${inspection.selectors.common.length} repeated element patterns
- Most common pattern: ${inspection.selectors.common[0] || 'none found'}
- Page has ${inspection.structure.headings.length} headings, ${inspection.structure.links.length} links

${digestInfo}

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
4. If failed, EXACTLY 3 specific, actionable suggestions that can be directly appended to the original instruction

Format your response as JSON:
{
  "success": boolean,
  "analysis": "Your 2-3 sentence analysis",
  "reason": "Brief reason for success/failure",
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"] // REQUIRED if failed, must be 3 items
}

IMPORTANT for suggestions:
- Each suggestion must be a complete instruction that can be appended to the original command
- Make them specific and actionable (e.g., "Press Enter key after typing instead of clicking button")
- Do NOT use vague language like "try different selector" - be specific about what to try
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
        { name: '✏️ Modify and try different approach', value: 'modify' },
        { name: '🔄 Refine with feedback - Different results needed', value: 'refine-feedback' },
        { name: '🚀 Continue building workflow from here...', value: 'continue' },
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

      case 'refine-feedback':
        this.log(`\n📜 Original instruction: "${instruction}"`)
        this.log(`\n📊 Current result:`)
        
        // Show the output from the last successful attempt
        const lastSuccessfulAttempt = this.attempts[this.attempts.length - 1]
        if (lastSuccessfulAttempt && lastSuccessfulAttempt.result) {
          const resultSummary = this.formatResultForFeedback(lastSuccessfulAttempt.result)
          this.log(resultSummary)
        }
        
        const { feedbackText } = await inquirer.prompt([{
          type: 'input',
          name: 'feedbackText',
          message: 'What needs to be different about the results?',
          validate: (input) => input.trim().length > 0 || 'Please provide your feedback'
        }])

        // Create a structured refinement that includes the output
        const refinedWithFeedback = this.createRefinedInstruction(
          instruction,
          lastSuccessfulAttempt?.result,
          feedbackText
        )
        
        this.log(`\n📝 Refining with your feedback...`)

        // Keep previous attempts for context
        await this.attemptWorkflow(refinedWithFeedback, flags, this.attempts)
        break

      case 'continue':
        this.log('\n🚀 Continue building from current page...')
        const currentUrl = await this.page!.url()
        this.log(`📍 Current page: ${currentUrl}`)

        const { continuationInstruction } = await inquirer.prompt([{
          type: 'input',
          name: 'continuationInstruction',
          message: 'What would you like to do next from this page?',
          validate: (input) => input.trim().length > 0 || 'Please describe what to do next'
        }])

        // Continue with existing workflow as base
        await this.continueWorkflow(instruction, yamlText, continuationInstruction, flags)
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

  private async continueWorkflow(
    originalInstruction: string,
    existingYaml: string,
    continuationInstruction: string,
    flags: any
  ): Promise<void> {
    // Build a special prompt for continuing workflows
    const currentUrl = await this.page!.url()
    const pageTitle = await this.page!.title()

    const continuationPrompt = `You are continuing an existing workflow. The user has navigated to an interesting page and wants to extend the workflow from there.

EXISTING WORKFLOW:
Original instruction: "${originalInstruction}"
Current YAML:
${existingYaml}

CURRENT STATE:
- URL: ${currentUrl}
- Page Title: ${pageTitle}
- The workflow above has already been executed successfully
- The browser is now on the page where the user wants to continue

CONTINUATION REQUEST:
"${continuationInstruction}"

IMPORTANT RULES:
1. Generate ONLY the NEW steps to add to the workflow
2. Do NOT repeat the existing steps
3. Start your YAML output with the first new step
4. The new steps should seamlessly continue from where the existing workflow left off
5. Return ONLY valid YAML - no explanations

${this.buildSystemPrompt().split('AVAILABLE COMMANDS:')[1]}`

    this.log("\n🤖 Generating continuation steps...")

    try {
      const raw = await askClaude(continuationPrompt)
      const newStepsYaml = this.cleanYamlOutput(raw)

      // Validate the new steps
      this.validateYaml(newStepsYaml)

      // Combine existing and new YAML
      const combinedYaml = this.combineYamlWorkflows(existingYaml, newStepsYaml)

      this.log("\n📝 Extended workflow:")
      this.log(combinedYaml)

      // Execute only the new steps
      const newSteps = yaml.parse(newStepsYaml)
      const executor = new WorkflowExecutor(this.page!, continuationInstruction)

      this.log("\n🚀 Executing new steps...")
      const result = await executor.execute(newSteps, {
        strict: false,
        captureOutput: true
      })

      this.showExecutionSummary(result)

      // Create a new attempt with the combined workflow
      const attempt: WorkflowAttempt = {
        prompt: `${originalInstruction} + ${continuationInstruction}`,
        yaml: combinedYaml,
        result
      }

      this.attempts.push(attempt)

      // Verify and handle next steps
      if (flags.interactive) {
        const verification = await this.verifyResults(
          `${originalInstruction} and then ${continuationInstruction}`,
          attempt,
          result
        )

        this.log("\n🔍 AI Verification:")
        this.log(verification.analysis)

        if (verification.success) {
          this.log("\n✅ " + verification.reason)
          await this.handleSuccessfulWorkflow(
            `${originalInstruction} and then ${continuationInstruction}`,
            combinedYaml,
            flags
          )
        } else {
          this.log("\n⚠️  " + verification.reason)
          await this.handleFeedbackLoop(
            `${originalInstruction} and then ${continuationInstruction}`,
            attempt,
            flags,
            verification
          )
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Error generating continuation: ${errorMessage}`)
    }
  }

  private combineYamlWorkflows(existingYaml: string, newYaml: string): string {
    // Parse both YAML documents
    const existingSteps = yaml.parse(existingYaml)
    const newSteps = yaml.parse(newYaml)

    // Combine arrays
    const combined = [...existingSteps, ...newSteps]

    // Convert back to YAML
    return yaml.stringify(combined)
  }

  private formatResultForFeedback(result: WorkflowExecutionResult): string {
    const lines: string[] = []
    
    // Show data extraction results if any
    const dataSteps = result.steps.filter(step => 
      step.command === 'evaluate' && step.output && !step.output.includes('undefined')
    )
    
    if (dataSteps.length > 0) {
      dataSteps.forEach(step => {
        if (step.output) {
          lines.push(step.output)
        }
      })
    }
    
    // Show failed steps
    if (result.failedSteps > 0) {
      lines.push('\n❌ Failed steps:')
      result.steps.filter(step => !step.success).forEach(step => {
        lines.push(`   Step ${step.stepNumber} (${step.command}): ${step.error}`)
      })
    }
    
    // Show execution summary
    lines.push(`\n📊 Execution Summary:`)
    lines.push(`   Total steps: ${result.totalSteps}`)
    lines.push(`   ✅ Successful: ${result.successfulSteps}`)
    lines.push(`   ❌ Failed: ${result.failedSteps}`)
    
    return lines.join('\n')
  }

  private createRefinedInstruction(
    originalInstruction: string,
    lastResult: WorkflowExecutionResult | undefined,
    feedbackText: string
  ): string {
    let refinedInstruction = originalInstruction
    
    // Add context about what was extracted/found
    if (lastResult) {
      const dataSteps = lastResult.steps.filter(step => 
        step.command === 'evaluate' && step.output && !step.output.includes('undefined')
      )
      
      if (dataSteps.length > 0) {
        refinedInstruction += `. Previous attempt extracted: ${dataSteps[0].output?.split('\n')[0]}`
      }
    }
    
    // Add the user's feedback
    refinedInstruction += `. ${feedbackText}`
    
    return refinedInstruction
  }
}