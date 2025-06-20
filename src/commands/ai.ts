import { Args, Flags, type Config } from "@oclif/core"
import { BaseCommand } from "../base.js"
import { askClaude } from "../utils/claude.js"
import { WorkflowExecutor } from "../utils/workflow-executor.js"
import { WorkflowStorage } from "../utils/workflow-storage.js"
import { DOMInspector } from "../utils/dom-inspector.js"
import { RunLogManager } from "../utils/run-log.js"
import { DOMDigestCollector } from "../utils/dom-digest.js"
import * as yaml from "yaml"
import { input, confirm, select } from "@inquirer/prompts"
import type { WorkflowExecutionResult } from "../types/workflow.js"

interface WorkflowAttempt {
  prompt: string
  yaml: string
  result?: WorkflowExecutionResult
  claudeAnalysis?: string
  runLogId?: string
  fullOutput?: string        // Complete stdout/stderr from the run
}

interface VerificationResult {
  success: boolean
  analysis: string
  reason: string
  suggestions?: string[]
  favoriteSuggestion?: number
  favoriteReasoning?: string
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
    "early-bailout": Flags.boolean({
      description: "Stop execution immediately when a step fails",
      default: true,
      allowNo: true,
    }),
    auto: Flags.boolean({
      description: "Automatically apply AI's favorite suggestion and retry until success",
      default: false,
    }),
    debug: Flags.boolean({
      description: "Enable debug logging for terminal states and interactions",
      default: false,
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

  constructor(argv: string[], config: Config) {
    super(argv, config)
    this.runLogManager = new RunLogManager()
  }

  private async stabilizeTerminal(debug = false): Promise<void> {
    // Since we're using @inquirer/prompts everywhere, we just need minimal cleanup
    // Inquirer handles all the terminal state management for us
    
    if (debug) {
      this.log('\n[DEBUG] stabilizeTerminal() called - simplified version')
    }
    
    // Ensure cursor is visible
    process.stdout.write('\x1b[?25h')
    
    // Clear any residual line content
    process.stdout.write('\r\x1b[K')
    
    // Small delay to let any pending output complete
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AI)

    // Initial attempt
    await this.attemptWorkflow(args.instruction, flags)
    
    // Ensure process exits cleanly after workflow completion
    process.exit(0)
  }

  private async attemptWorkflow(instruction: string, flags: Record<string, unknown>, previousAttempts?: WorkflowAttempt[]): Promise<void> {
    // Quick DOM scan if we're already connected to a page
    let domQuickScan: string | undefined
    if (this.page) {
      try {
        const ora = (await import('ora')).default
        const quickScanSpinner = ora('🔍 Scanning page elements...').start()
        const inspector = new DOMInspector(this.page)
        const inspection = await inspector.inspectForDataExtraction('')
        
        // Get page context
        const pageUrl = this.page.url()
        const pageTitle = await this.page.title()
        
        // Check for common issues
        const pageChecks = await this.page.evaluate(() => {
          const checks: any = {
            hasModals: !!document.querySelector('[role="dialog"], .modal, .popup, [class*="modal"][style*="display: block"]'),
            hasOverlay: !!document.querySelector('.overlay:not([style*="display: none"]), .backdrop:not([style*="display: none"])'),
            hasLoader: !!document.querySelector('.loader:not([style*="display: none"]), .loading:not([style*="display: none"]), .spinner:not([style*="display: none"])'),
            hasAlerts: !!document.querySelector('[role="alert"], .alert, .error, .warning'),
            hasIframes: document.querySelectorAll('iframe').length,
            formCount: document.querySelectorAll('form').length,
            disabledButtons: Array.from(document.querySelectorAll('button:disabled, input[type="submit"]:disabled')).length,
            readonlyInputs: Array.from(document.querySelectorAll('input[readonly], textarea[readonly]')).length
          }
          
          // Get any visible error messages
          const errorElements = Array.from(document.querySelectorAll('.error, .alert-danger, [class*="error"]:not([style*="display: none"])'))
          checks.errorMessages = errorElements.slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean)
          
          return checks
        })
        
        // Format interactive elements for Claude
        const elements: string[] = []
        
        // Add page context
        elements.push(`PAGE CONTEXT:`)
        elements.push(`  URL: ${pageUrl}`)
        elements.push(`  Title: ${pageTitle}`)
        
        // Add warnings about potential issues
        if (pageChecks.hasModals || pageChecks.hasOverlay || pageChecks.hasLoader) {
          elements.push(`\n⚠️  WARNINGS:`)
          if (pageChecks.hasModals) elements.push(`  - Modal/dialog detected - may block interactions`)
          if (pageChecks.hasOverlay) elements.push(`  - Overlay detected - may block clicks`)
          if (pageChecks.hasLoader) elements.push(`  - Loading indicator detected - page may still be loading`)
        }
        
        if (pageChecks.errorMessages && pageChecks.errorMessages.length > 0) {
          elements.push(`\n❌ ERROR MESSAGES:`)
          pageChecks.errorMessages.forEach((msg: string) => {
            elements.push(`  - "${msg}"`)
          })
        }
        
        // Add visible buttons
        if (inspection.structure.buttons.length > 0) {
          elements.push('\nBUTTONS:')
          inspection.structure.buttons.slice(0, 10).forEach(btn => {
            elements.push(`  - ${btn.selector}: "${btn.text}"`)
          })
          if (pageChecks.disabledButtons > 0) {
            elements.push(`  ⚠️  ${pageChecks.disabledButtons} disabled button(s) detected`)
          }
        }
        
        // Add inputs with visibility info
        const visibleInputs = inspection.structure.inputs.filter(i => i.visible !== false)
        const hiddenInputs = inspection.structure.inputs.filter(i => i.visible === false)
        
        if (visibleInputs.length > 0 || hiddenInputs.length > 0) {
          elements.push('\nINPUTS:')
          visibleInputs.slice(0, 10).forEach(input => {
            const desc = input.placeholder || input.name || input.type
            elements.push(`  - ${input.selector}: ${desc} (${input.type})`)
          })
          if (hiddenInputs.length > 0) {
            elements.push(`  ⚠️  ${hiddenInputs.length} hidden input(s) - may need to click something to reveal`)
          }
          if (pageChecks.readonlyInputs > 0) {
            elements.push(`  ⚠️  ${pageChecks.readonlyInputs} readonly input(s) detected`)
          }
        }
        
        // Add info about forms
        if (pageChecks.formCount > 0) {
          elements.push(`\n📝 FORMS: ${pageChecks.formCount} form(s) detected`)
        }
        
        // Add hidden element triggers if found
        if (inspection.visibility?.revealTriggers?.length > 0) {
          elements.push('\n🔓 TO REVEAL HIDDEN ELEMENTS:')
          inspection.visibility.revealTriggers.slice(0, 3).forEach(trigger => {
            elements.push(`  - Click "${trigger.triggerSelector}" to ${trigger.action}`)
          })
        }
        
        // Add links if relevant
        if (inspection.structure.links.length > 0) {
          elements.push('\nLINKS:')
          inspection.structure.links.slice(0, 5).forEach(link => {
            elements.push(`  - ${link.selector}: "${link.text}"`)
          })
        }
        
        // Add iframe warning
        if (pageChecks.hasIframes > 0) {
          elements.push(`\n⚠️  ${pageChecks.hasIframes} iframe(s) detected - elements inside iframes need special handling`)
        }
        
        if (elements.length > 0) {
          domQuickScan = elements.join('\n')
        }
        
        quickScanSpinner.succeed('🔍 Page scan complete')
      } catch (error) {
        // Ignore scan errors
      }
    }

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
    const systemPrompt = this.buildSystemPrompt(previousAttempts, domDigest, domQuickScan)

    // Structure the instruction based on whether this is a retry
    let structuredInstruction = ''
    if (previousAttempts && previousAttempts.length > 0) {
      // Tell Claude the earlier guidance FAILED and must be replaced
      structuredInstruction = `
The previous instructions did NOT work - throw them away.
Write a BRAND-NEW YAML workflow that satisfies the user request below
using what you learned from the runtime output.

<user-request>
${instruction}
</user-request>`
    } else {
      structuredInstruction = `User request:\n${instruction}`
    }

    const fullPrompt = `${systemPrompt}\n\n${structuredInstruction}`

    const ora = (await import('ora')).default
    const claudeSpinner = ora('🤖 Asking Claude...').start()

    try {
      const raw = await askClaude(fullPrompt)
      claudeSpinner.succeed('🤖 Claude responded')
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

      // Grab a verbatim, line-by-line dump for Claude
      const fullOutput = result.steps
        .map(s => {
          const status = s.success ? '✅' : '❌'
          const details = s.output ?? s.error ?? 'No output'
          return `[${status}] Step ${s.stepNumber} - ${s.command}: ${details}`
        })
        .join('\n')

      // Store this attempt
      const attempt: WorkflowAttempt = {
        prompt: instruction,
        yaml: yamlText,
        result,
        fullOutput
      }
      this.attempts.push(attempt)

      // Show execution summary
      this.showExecutionSummary(result)

      // If interactive mode, always verify results with Claude
      if (flags.interactive) {
        const ora5 = (await import('ora')).default
        const verifySpinner = ora5('🔍 Verifying results with AI...').start()
        
        const verification = await this.verifyResults(instruction, attempt, result)
        
        verifySpinner.succeed('🔍 AI Verification complete')

        // Show verification to user
        this.log(verification.analysis)

        // Handle next steps based on verification
        if (verification.success) {
          this.log(`\n✅ ${verification.reason}`)
          
          // In auto mode, just save and exit on success
          if (flags.auto) {
            this.log('\n🎉 Auto mode: Workflow succeeded!')
            await this.promptSaveWorkflow(instruction, yamlText, false, flags.debug as boolean)
            process.exit(0)
          } else {
            await this.handleSuccessfulWorkflow(instruction, yamlText, flags)
          }
        } else {
          this.log(`\n⚠️  ${verification.reason}`)
          await this.handleFeedbackLoop(instruction, attempt, flags, verification)
        }
      }

    } catch (error) {
      claudeSpinner.fail('🤖 Claude request failed')
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Error: ${errorMessage}`)
    }
  }

  private buildSystemPrompt(previousAttempts?: WorkflowAttempt[], domDigest?: string, domQuickScan?: string): string {
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
- click: Click an element (selector or {selector, button, clickCount, force: true})
- type: Type text ({selector, text} or "selector text")
- wait: Wait for element/URL ({selector, timeout} or {url, timeout} or {message: "custom message"} for user input)
- screenshot: Take screenshot (filename or {path, fullPage})
- scroll: Scroll page ({to: percentage} or {selector})
- evaluate: Run JavaScript ({script} or script string) - USE THIS FOR DATA EXTRACTION/SCRAPING
- hover: Hover over element (selector)
- select: Select dropdown option ({selector, value/label/index})
- fill: Fill form field ({selector, value})
- assert: Assert condition ({selector, text/value/visible})
- keypress: Press keyboard key (key string like "Enter", "Tab", "Escape")

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

VISIBILITY AND INTERACTION PATTERNS:
- If you encounter "element is not visible" errors:
  1. The element might be hidden until another action reveals it
  2. Look for related buttons/icons that might toggle visibility
  3. Try hovering over parent elements that might reveal hidden content
  4. Consider if the element appears after page interactions
- Learn from error messages - they often indicate what went wrong:
  - "not visible" = element exists but is hidden
  - "timeout exceeded" = element doesn't exist or selector is wrong
  - "multiple elements" = selector is too broad
- Adapt your approach based on previous attempts and error patterns

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

INTERACTIVE WAIT USAGE:
- When user asks to "wait for me to sign in" or "pause for manual action", use: 
  - wait: {message: "Press Enter when you have signed in"}
- This will pause the workflow and display the message in the terminal
- The user can then perform manual actions in the browser
- The workflow continues when the user presses Enter
- Examples:
  - wait: {message: "Press Enter after completing 2FA"}
  - wait: {message: "Press Enter when you've accepted cookies"}
  - wait: {message: "Sign in to your account and press Enter to continue"}

SELECTOR SYNTAX RULES:
- ALWAYS use double quotes for attribute selectors: input[type="search"] (NOT input[type='search'])
- NEVER use escaped quotes like input[type=\'search\'] or input[type=\"search\"]
- For complex attribute values, keep using double quotes: a[href="https://example.com"]
- Valid examples:
  - wait: input[type="search"]
  - click: button[data-testid="submit"]
  - type:
      selector: input[name="username"]
      text: my text
- Invalid examples (DO NOT USE):
  - wait: input[type='search']  # Single quotes will fail
  - click: input[type=\'search\']  # Escaped quotes will fail
  - wait: "input[type='search']"  # Wrapping the whole selector in quotes is wrong

LEARNING FROM FAILURES:
- When you see previous attempts with runtime output, analyze what went wrong
- DO NOT append to or modify the previous YAML - start completely fresh
- Use the runtime errors to understand what selectors/approaches don't work
- Apply lessons learned to create a working solution from scratch`

    // Add current page context if available
    if (domQuickScan) {
      prompt += `\n\n${domQuickScan}\n\nIMPORTANT: Use the exact selectors shown above when interacting with these elements.`
    }

    // Add context from previous attempts
    if (previousAttempts && previousAttempts.length > 0) {
      prompt += "\n\nPREVIOUS ATTEMPTS AND RESULTS:"

      previousAttempts.forEach((attempt, idx) => {
        prompt += `\n\n🕑 Attempt ${idx + 1}`

        // 1. The YAML Claude produced
        prompt += `\n--- YAML (attempt ${idx + 1}) ---\n${attempt.yaml}\n`

        // 2. The verbatim run output (every step)
        if (attempt.fullOutput) {
          prompt += `\n--- Runtime output (attempt ${idx + 1}) ---\n${attempt.fullOutput}\n`
        }

        // 3. Short structured analysis (kept for backward-compat)
        if (attempt.result) {
          prompt += WorkflowExecutor.formatResultsForAnalysis(
            attempt.result,
            attempt.prompt,
            attempt.yaml
          )
          
          // Add detailed error analysis for learning
          const failedSteps = attempt.result.steps.filter(s => !s.success)
          if (failedSteps.length > 0) {
            prompt += "\n\nERROR PATTERNS TO LEARN FROM:"
            for (const step of failedSteps) {
              if (step.error?.includes('not visible')) {
                prompt += `\n- Step ${step.stepNumber}: Element "${step.args}" exists but is not visible. This suggests it may need to be revealed by another interaction first.`
              } else if (step.error?.includes('Timeout') && step.error?.includes('exceeded')) {
                prompt += `\n- Step ${step.stepNumber}: Selector "${step.args}" timed out. Either the selector is wrong or the element doesn't exist yet.`
              } else if (step.error?.includes('multiple elements')) {
                prompt += `\n- Step ${step.stepNumber}: Selector "${step.args}" matched multiple elements. Use a more specific selector.`
              }
            }
          }
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

  private async executeWorkflow(yamlText: string, flags: Record<string, unknown>, instruction?: string): Promise<WorkflowExecutionResult> {
    // Try to connect to Chrome, auto-launch if needed
    try {
      await this.connectToChrome(
        flags.port as number | undefined,
        flags.host as string | undefined,
        flags.launch as boolean | undefined,
        flags.profile as string | undefined,
        flags.headless as boolean | undefined,
        flags.verbose as boolean | undefined,
        flags.keepOpen as boolean | undefined
      )
    } catch (error) {
      // If connection failed and launch wasn't already true, try auto-launching
      if (!flags.launch) {
        this.log('🚀 No Chrome instance found. Auto-launching Chrome...')
        await this.connectToChrome(
          flags.port as number | undefined,
          flags.host as string | undefined,
          true, // Force launch
          flags.profile as string | undefined,
          flags.headless as boolean | undefined,
          flags.verbose as boolean | undefined,
          flags.keepOpen as boolean | undefined
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
      this.digestCollector = new DOMDigestCollector(this.page)
    }

    // Parse workflow
    const workflow = yaml.parse(yamlText)

    // Execute with WorkflowExecutor
    const executor = new WorkflowExecutor(this.page, instruction)
    
    const ora2 = (await import('ora')).default
    let currentStepSpinner: any = null
    let result: WorkflowExecutionResult
    const executionStartTime = Date.now()
    
    try {
      result = await executor.execute(workflow, {
        strict: flags["early-bailout"] as boolean, // Use early bailout flag
        captureOutput: true,
        debug: flags.debug as boolean,
        onStepStart: (stepNumber, command, args) => {
          // Stop previous spinner if exists
          if (currentStepSpinner) {
            currentStepSpinner.stop()
          }
          
          // Format args for display
          const argsDisplay = typeof args === 'string' 
            ? args.substring(0, 50) + (args.length > 50 ? '...' : '')
            : args.selector || args.url || JSON.stringify(args).substring(0, 50)
          
          currentStepSpinner = ora2(`Step ${stepNumber}: ${command} ${argsDisplay}`).start()
        },
        onStepComplete: (stepNumber, command, success) => {
          if (currentStepSpinner) {
            if (success) {
              currentStepSpinner.succeed(`Step ${stepNumber}: ${command} ✓`)
            } else {
              currentStepSpinner.fail(`Step ${stepNumber}: ${command} ✗`)
            }
            currentStepSpinner = null
          }
        }
      })
    } catch (error) {
      // Clean up spinner on error
      if (currentStepSpinner) {
        currentStepSpinner.stop()
      }
      
      // Extract step results from the executor even on failure
      const partialResults = executor.getStepResults()
      const failedStep = partialResults[partialResults.length - 1]
      
      // Create a result object for early bailout
      result = {
        success: false,
        totalSteps: workflow.length,
        successfulSteps: partialResults.filter(s => s.success).length,
        failedSteps: partialResults.filter(s => !s.success).length,
        steps: partialResults,
        totalDuration: Date.now() - executionStartTime,
        earlyBailout: true
      } as WorkflowExecutionResult
      
      // Show early bailout message
      if (flags["early-bailout"] && failedStep) {
        this.log(`\n🛑 Execution stopped early due to failure at step ${failedStep.stepNumber}`)
        this.log(`   Failed command: ${failedStep.command}`)
        if (failedStep.error) {
          this.log(`   Error: ${failedStep.error}`)
        }
      }
    }
    
    // Clean up any remaining spinner
    if (currentStepSpinner) {
      currentStepSpinner.stop()
    }

    // Create run log
    try {
      await this.runLogManager.init()
      const currentUrl = this.page.url()
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
    
    if (result.earlyBailout) {
      this.log(`   🛑 Early bailout: Yes`)
    }

    if (result.failedSteps > 0) {
      this.log("\n❌ Failed steps:")
      for (const step of result.steps.filter(step => !step.success)) {
        this.log(`   Step ${step.stepNumber} (${step.command}): ${step.error}`)
      }
    }
  }

  private async handleFeedbackLoop(
    originalInstruction: string,
    lastAttempt: WorkflowAttempt,
    flags: Record<string, unknown>,
    verification?: VerificationResult
  ): Promise<void> {
    // Use provided verification or get Claude's analysis
    if (!verification) {
      const analysisPrompt = `${WorkflowExecutor.formatResultsForAnalysis(
        lastAttempt.result ?? {} as WorkflowExecutionResult,
        originalInstruction,
        lastAttempt.yaml
      )}\n\nProvide a brief analysis of what went wrong and what should be changed.`

      const ora3 = (await import('ora')).default
      const analysisSpinner = ora3('🔍 Analyzing results...').start()
      const analysis = await askClaude(analysisPrompt)
      analysisSpinner.succeed('🔍 Analysis complete')
      lastAttempt.claudeAnalysis = analysis

      this.log("\n💡 Claude's analysis:")
      this.log(analysis)
    } else {
      lastAttempt.claudeAnalysis = verification.analysis

      // Show suggestions if available
      if (verification.suggestions && verification.suggestions.length > 0) {
        this.log("\n💡 Suggestions for improvement:")
        for (const [index, suggestion] of verification.suggestions.entries()) {
          const isFavorite = verification.favoriteSuggestion === index
          const prefix = isFavorite ? '⭐' : '  '
          this.log(`   ${prefix} ${index + 1}. ${suggestion}`)
        }
        
        // Show AI's reasoning for its favorite
        if (verification.favoriteReasoning && verification.favoriteSuggestion !== undefined) {
          this.log(`\n🤖 AI recommends option ${verification.favoriteSuggestion + 1}:`)
          this.log(`   ${verification.favoriteReasoning}`)
        }
      }
      
      // If debug mode, add hint about arrow keys
      if (flags.debug && !flags.auto) {
        this.log('\n[DEBUG] If arrow keys are not working, check the terminal state logs above')
        this.log('[DEBUG] Arrow keys should produce: Up=0x1b 0x5b 0x41, Down=0x1b 0x5b 0x42')
      }
    }

    // Auto mode: automatically select AI's favorite suggestion
    if (flags.auto && verification?.favoriteSuggestion !== undefined && verification?.suggestions?.length) {
      // Prevent infinite loops - max 10 attempts
      if (this.attempts.length >= 10) {
        this.log(`\n❌ Auto mode: Maximum attempts (10) reached without success.`)
        this.log(`   Consider running without --auto flag for manual control.`)
        process.exit(1)
      }
      
      const favoriteIndex = verification.favoriteSuggestion
      const favoriteSuggestion = verification.suggestions[favoriteIndex]
      
      this.log(`\n🤖 Auto mode: Attempt ${this.attempts.length + 1}/10 - Applying AI's favorite suggestion...`)
      this.log(`   Selected: "${favoriteSuggestion}"`)
      
      const refinedInstruction = await this.createAIRefinedInstruction(
        originalInstruction,
        favoriteSuggestion,
        { lastResult: lastAttempt.result }
      )
      
      this.log(`🎯 Refined instruction: "${refinedInstruction}"`)
      
      // Add small delay for readability
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Continue with refined instruction
      await this.attemptWorkflow(refinedInstruction, flags, this.attempts)
      return
    }

    // Build menu choices with suggestions as first options
    const choices: Array<{ name: string; value: string }> = []

    // Add suggestion-based choices first
    if (verification?.suggestions?.length) {
      for (const [index, suggestion] of verification.suggestions.slice(0, 3).entries()) {
        const isFavorite = verification.favoriteSuggestion === index
        const prefix = isFavorite ? '⭐' : '💡'
        choices.push({
          name: `${prefix} ${index + 1}. ${suggestion}`,
          value: `suggestion_${index}`
        })
      }
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

    // Debug logging for menu state
    if (flags.debug) {
      this.log('\n[DEBUG] About to show select menu')
      this.log(`[DEBUG] Number of choices: ${choices.length}`)
      this.log(`[DEBUG] Choices:`)
      choices.forEach((c, i) => {
        this.log(`  ${i}: ${c.name} -> ${c.value}`)
      })
    }
    
    // Ensure terminal is in proper state for interactive prompt
    await this.stabilizeTerminal(flags.debug as boolean)
    
    let action: string
    
    if (flags.debug) {
      this.log('\n[DEBUG] About to call select() prompt')
      this.log(`[DEBUG] Terminal is ready for Inquirer prompt`)
    }
    
    action = await select<string>({
      message: 'The workflow needs improvement. What would you like to do?',
      choices
    })

    // Handle suggestion selections
    if (action.startsWith('suggestion_')) {
      const suggestionIndex = Number.parseInt(action.split('_')[1])
      const suggestion = verification?.suggestions?.[suggestionIndex] ?? ''

      this.log(`\n📝 Applying suggestion: "${suggestion}"`)
      
      // Use AI to intelligently merge the suggestion
      const refinedInstruction = await this.createAIRefinedInstruction(
        originalInstruction,
        suggestion,
        { lastResult: lastAttempt.result }
      )
      
      this.log(`🎯 Refined instruction: "${refinedInstruction}"`)

      // Keep previous attempts for context
      await this.attemptWorkflow(refinedInstruction, flags, this.attempts)
      return
    }

    switch (action) {
      case 'autofix':
        this.log(`\n🔄 Attempt ${this.attempts.length + 1}...`)
        await this.attemptWorkflow(originalInstruction, flags, this.attempts)
        break

      case 'modify': {
        await this.stabilizeTerminal(flags.debug as boolean)
        const newInstruction = await input({
          message: 'Enter modified instruction:',
          default: originalInstruction
        })

        // Reset attempts for new instruction
        this.attempts = []
        await this.attemptWorkflow(newInstruction, flags)
        break
      }

      case 'refine-feedback': {
        this.log(`\n📜 Original instruction: "${originalInstruction}"`)
        this.log('\n📊 Previous result:')

        // Show the output from the last attempt
        if (lastAttempt.result) {
          const resultSummary = this.formatResultForFeedback(lastAttempt.result)
          this.log(resultSummary)
        }

        await this.stabilizeTerminal(flags.debug as boolean)
        const feedbackText = await input({
          message: 'What needs to be corrected or improved?',
          validate: (value) => value.trim().length > 0 || 'Please provide your feedback'
        })

        // Create a structured refinement that includes the output
        const refinedInstruction = await this.createRefinedInstruction(
          originalInstruction,
          lastAttempt.result,
          feedbackText
        )

        this.log('\n🎯 Refined instruction:')
        this.log(refinedInstruction)

        // Keep previous attempts for context
        await this.attemptWorkflow(refinedInstruction, flags, this.attempts)
        break
      }

      case 'refine': {
        await this.stabilizeTerminal(flags.debug as boolean)
        const refinementType = await select<string>({
          message: 'What would you like to refine?',
          choices: [
            { name: 'Specify exact element text or attributes', value: 'element' },
            { name: 'Add wait conditions', value: 'wait' },
            { name: 'Specify data format', value: 'format' },
            { name: 'Add error handling', value: 'error' }
          ]
        })

        let refinedSelectorInstruction = originalInstruction

        switch (refinementType) {
          case 'element': {
            await this.stabilizeTerminal(flags.debug as boolean)
            const elementDetails = await input({
              message: 'Describe the element more specifically (e.g., "the blue submit button", "link containing \'Login\'"):'
            })
            refinedSelectorInstruction = await this.createAIRefinedInstruction(
              originalInstruction,
              `Look for ${elementDetails}`,
              { verificationType: 'element-specification' }
            )
            break
          }

          case 'wait': {
            await this.stabilizeTerminal(flags.debug as boolean)
            const waitDetails = await input({
              message: 'What should we wait for? (e.g., "wait for loading spinner to disappear", "wait 2 seconds"):'
            })
            refinedSelectorInstruction = await this.createAIRefinedInstruction(
              originalInstruction,
              waitDetails,
              { verificationType: 'wait-condition' }
            )
            break
          }

          case 'format': {
            await this.stabilizeTerminal(flags.debug as boolean)
            const formatDetails = await input({
              message: 'How should the data be formatted? (e.g., "as CSV", "only titles", "include links"):'
            })
            refinedSelectorInstruction = await this.createAIRefinedInstruction(
              originalInstruction,
              `Format the data ${formatDetails}`,
              { verificationType: 'data-format' }
            )
            break
          }

          case 'error':
            refinedSelectorInstruction = await this.createAIRefinedInstruction(
              originalInstruction,
              'If elements are not found, try alternative selectors. Handle any errors gracefully',
              { verificationType: 'error-handling' }
            )
            break
        }

        this.log(`\n🎯 AI-refined instruction:`)
        this.log(refinedSelectorInstruction)
        await this.attemptWorkflow(refinedSelectorInstruction, flags, this.attempts)
        break
      }

      case 'save':
        await this.promptSaveWorkflow(originalInstruction, lastAttempt.yaml, true, flags.debug as boolean) // Skip confirmation since user chose "Save anyway"
        break

      case 'quit':
        this.log('👋 Exiting without saving.')
        process.exit(0)
        break
    }
  }

  private async promptSaveWorkflow(instruction: string, yamlText: string, skipConfirmation = false, debug = false): Promise<void> {
    if (!skipConfirmation) {
      await this.stabilizeTerminal(debug)
      const shouldSave = await confirm({
        message: 'Would you like to save this workflow?',
        default: true
      })

      if (!shouldSave) {
        this.log('✅ Workflow completed without saving.')
        return
      }
    }

    await this.stabilizeTerminal(debug)
    const name = await input({
      message: 'Workflow name:',
      validate: (value) => value.length > 0 || 'Name is required'
    })

    await this.stabilizeTerminal(debug)
    const description = await input({
      message: 'Description (optional):'
    })

    await this.stabilizeTerminal(debug)
    const tags = await input({
      message: 'Tags (comma-separated, optional):'
    })

    const tagArray = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined

    try {
      const saved = await this.storage.save(name, instruction, yamlText, description, tagArray)
      this.log(`\n✅ Workflow saved: ${saved.name} (${saved.id})`)
      this.log(`📁 Location: ~/.chromancer/workflows/${saved.id}.json`)
      this.log(`\n💡 Run it later with: chromancer workflows run "${name}"`)
      
      // Exit after successful save
      process.exit(0)
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
      const ora4 = (await import('ora')).default
      const inspectSpinner = ora4('🔍 Inspecting page structure to find better selectors...').start();
      const inspector = new DOMInspector(this.page);
      const inspection = await inspector.inspectWithDigest(instruction);
      inspectSpinner.succeed('🔍 Page inspection complete');

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

${inspection.visibility?.hiddenElements?.length > 0 ? `
VISIBILITY ANALYSIS:
Hidden elements detected:
${inspection.visibility.hiddenElements.map(h => `- ${h.selector}: ${h.reason}`).join('\n')}

Potential reveal triggers:
${inspection.visibility.revealTriggers.map(t => `- Click "${t.triggerSelector}" to ${t.action}`).join('\n')}
` : ''}

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
5. If failed, which suggestion (0, 1, or 2) is your favorite and why

Format your response as JSON:
{
  "success": boolean,
  "analysis": "Your 2-3 sentence analysis",
  "reason": "Brief reason for success/failure",
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"], // REQUIRED if failed, must be 3 items
  "favoriteSuggestion": 0, // 0-based index of your favorite suggestion (0, 1, or 2)
  "favoriteReasoning": "2-3 sentences explaining why this is the best approach"
}

IMPORTANT for suggestions:
- Each suggestion must be a complete instruction that can be appended to the original command
- Make them specific and actionable (e.g., "Press Enter key after typing instead of clicking button")
- Do NOT use vague language like "try different selector" - be specific about what to try
- Your favorite should be the one most likely to succeed based on the error patterns
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
          suggestions: parsed.suggestions,
          favoriteSuggestion: parsed.favoriteSuggestion,
          favoriteReasoning: parsed.favoriteReasoning
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
    flags: Record<string, unknown>
  ): Promise<void> {
    await this.stabilizeTerminal(flags.debug as boolean)
    
    if (flags.debug) {
      this.log('\n[DEBUG] About to show success menu')
      this.log('[DEBUG] Terminal is ready for Inquirer prompt')
    }
    
    const action = await select<string>({
      message: 'The workflow succeeded! What would you like to do?',
      choices: [
        { name: '💾 Save workflow for future use', value: 'save' },
        { name: '🔄 Run again', value: 'run' },
        { name: '✏️ Modify and try different approach', value: 'modify' },
        { name: '🔄 Refine with feedback - Different results needed', value: 'refine-feedback' },
        { name: '🚀 Continue building workflow from here...', value: 'continue' },
        { name: '✅ Done', value: 'done' }
      ]
    })

    switch (action) {
      case 'save':
        await this.promptSaveWorkflow(instruction, yamlText, true, flags.debug as boolean) // Skip confirmation since user already chose to save
        break

      case 'run':
        this.log("\n🔄 Running workflow again...")
        await this.attemptWorkflow(instruction, flags, this.attempts)
        break

      case 'modify': {
        await this.stabilizeTerminal(flags.debug as boolean)
        const newInstruction = await input({
          message: 'Enter modified instruction:',
          default: instruction
        })
        this.attempts = []
        await this.attemptWorkflow(newInstruction, flags)
        break
      }

      case 'refine-feedback': {
        this.log(`\n📜 Original instruction: "${instruction}"`)
        this.log('\n📊 Current result:')

        // Show the output from the last successful attempt
        const lastSuccessfulAttempt = this.attempts[this.attempts.length - 1]
        if (lastSuccessfulAttempt?.result) {
          const resultSummary = this.formatResultForFeedback(lastSuccessfulAttempt.result)
          this.log(resultSummary)
        }

        await this.stabilizeTerminal(flags.debug as boolean)
        const feedbackText = await input({
          message: 'What needs to be different about the results?',
          validate: (value) => value.trim().length > 0 || 'Please provide your feedback'
        })

        // Create a structured refinement that includes the output
        const refinedWithFeedback = await this.createRefinedInstruction(
          instruction,
          lastSuccessfulAttempt?.result,
          feedbackText
        )

        this.log('\n🎯 Refined instruction:')
        this.log(refinedWithFeedback)

        // Keep previous attempts for context
        await this.attemptWorkflow(refinedWithFeedback, flags, this.attempts)
        break
      }

      case 'continue': {
        this.log('\n🚀 Continue building from current page...')
        if (!this.page) {
          this.error('No active page connection')
        }
        const currentUrl = this.page.url()
        this.log(`📍 Current page: ${currentUrl}`)

        await this.stabilizeTerminal(flags.debug as boolean)
        const continuationInstruction = await input({
          message: 'What would you like to do next from this page?',
          validate: (value) => value.trim().length > 0 || 'Please describe what to do next'
        })

        // Continue with existing workflow as base
        await this.continueWorkflow(instruction, yamlText, continuationInstruction, flags)
        break
      }

      case 'done':
        this.log('✅ Great! Workflow completed successfully.')
        process.exit(0)
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
    flags: Record<string, unknown>
  ): Promise<void> {
    // Build a special prompt for continuing workflows
    if (!this.page) {
      this.error('No active page connection')
    }
    const currentUrl = this.page.url()
    const pageTitle = await this.page?.title() ?? ''

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
      if (!this.page) {
        this.error('No active page connection')
      }
      const executor = new WorkflowExecutor(this.page, continuationInstruction)

      this.log("\n🚀 Executing new steps...")
      const result = await executor.execute(newSteps, {
        strict: flags["early-bailout"] as boolean,
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
        const ora6 = (await import('ora')).default
        const verifySpinner = ora6('🔍 Verifying results with AI...').start()
        
        const verification = await this.verifyResults(
          `${originalInstruction} and then ${continuationInstruction}`,
          attempt,
          result
        )
        
        verifySpinner.succeed('🔍 AI Verification complete')

        // Show verification to user
        this.log(verification.analysis)

        if (verification.success) {
          this.log(`\n✅ ${verification.reason}`)
          await this.handleSuccessfulWorkflow(
            `${originalInstruction} and then ${continuationInstruction}`,
            combinedYaml,
            flags
          )
        } else {
          this.log(`\n⚠️  ${verification.reason}`)
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
      for (const step of dataSteps) {
        if (step.output) {
          lines.push(step.output)
        }
      }
    }

    // Show failed steps
    if (result.failedSteps > 0) {
      lines.push('\n❌ Failed steps:')
      for (const step of result.steps.filter(step => !step.success)) {
        lines.push(`   Step ${step.stepNumber} (${step.command}): ${step.error}`)
      }
    }

    // Show execution summary
    lines.push('\n📊 Execution Summary:')
    lines.push(`   Total steps: ${result.totalSteps}`)
    lines.push(`   ✅ Successful: ${result.successfulSteps}`)
    lines.push(`   ❌ Failed: ${result.failedSteps}`)

    return lines.join('\n')
  }

  private async createRefinedInstruction(
    originalInstruction: string,
    lastResult: WorkflowExecutionResult | undefined,
    feedbackText: string
  ): Promise<string> {
    // Use AI to intelligently refine the instruction
    return await this.createAIRefinedInstruction(
      originalInstruction,
      feedbackText,
      { lastResult }
    )
  }

  private async createAIRefinedInstruction(
    originalInstruction: string,
    feedbackOrSuggestion: string,
    context?: {
      lastResult?: WorkflowExecutionResult,
      verificationType?: string
    }
  ): Promise<string> {
    const refinementPrompt = `You are refining a browser automation instruction based on user feedback.

ORIGINAL INSTRUCTION:
"${originalInstruction}"

${context?.lastResult ? `PREVIOUS EXECUTION RESULTS:
${this.formatResultForFeedback(context.lastResult)}` : ''}

USER FEEDBACK/SUGGESTION:
"${feedbackOrSuggestion}"

${context?.verificationType ? `REFINEMENT TYPE: ${context.verificationType}` : ''}

YOUR TASK:
Create a single, refined instruction that:
1. Incorporates the user's feedback into the original instruction
2. Removes any contradictions or redundancies
3. Maintains the original goal while applying the improvements
4. Is clear and specific without being overly prescriptive
5. Avoids accumulating conflicting instructions

IMPORTANT:
- DO NOT just append the feedback to the original
- DO NOT include meta-instructions like "remember to" or "make sure to"
- DO NOT reference previous attempts or failures
- Create ONE coherent instruction that achieves the goal

Return ONLY the refined instruction text, nothing else.`

    const ora7 = (await import('ora')).default
    const refineSpinner = ora7('🤖 Refining instruction with AI...').start()
    
    try {
      const refinedInstruction = await askClaude(refinementPrompt)
      refineSpinner.succeed('🤖 Instruction refined')
      return refinedInstruction.trim()
    } catch (error) {
      refineSpinner.fail('🤖 Failed to refine instruction')
      // Fallback to simple append if AI refinement fails
      return `${originalInstruction}. ${feedbackOrSuggestion}`
    }
  }
}