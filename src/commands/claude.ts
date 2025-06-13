import { Args, Flags } from "@oclif/core"
import { BaseCommand } from "../base.js"
import { askClaude } from "../utils/claude.js"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import * as yaml from "yaml"
import Run from "./run.js"

export default class Claude extends BaseCommand {
  static description =
    "Natural-language agent powered by Claude - turns English into Chromancer workflows"

  static examples = [
    '<%= config.bin %> <%= command.id %> "Click the login button and wait for #dashboard"',
    '<%= config.bin %> <%= command.id %> --dry-run "Scroll to 80% of the page"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    "dry-run": Flags.boolean({
      char: "d",
      description: "Show generated workflow but do NOT execute it",
      default: false,
    }),
    yaml: Flags.boolean({
      description: "Force Claude to output raw YAML only (no prose)",
      default: false,
    }),
  }

  static args = {
    instruction: Args.string({
      description: "English instruction for Claude",
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Claude)

    // 1) Build the system prompt
    const sys = `You are an expert Chromancer automation engineer. Convert the user's natural language instruction into a valid YAML workflow.

OUTPUT RULES:
1. Return ONLY valid YAML - no markdown, no explanations, no comments
2. Use array format with one command per step
3. Each step must be a single key-value pair
4. Use proper YAML indentation (2 spaces)

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
- if/then/else: Conditional logic
- for: Loop over items

IMPORTANT: Your output must be valid YAML that starts with a dash (-) for each step.

EXAMPLES:

Input: "Go to google and search for puppies"
Output:
- navigate: https://google.com
- type:
    selector: "textarea[name='q']"
    text: "puppies"
- click: "input[type='submit']"

Input: "Login with user@example.com and password123"
Output:
- type:
    selector: "input[name='username'], input[name='email'], #email"
    text: "user@example.com"
- type:
    selector: "input[name='password'], input[type='password']"
    text: "password123"
- click: "button[type='submit'], input[type='submit'], .login-button"

Input: "Take a full page screenshot"
Output:
- screenshot:
    path: screenshot.png
    fullPage: true

Input: "Wait for the page to load and click the first link"
Output:
- wait:
    selector: "body"
    timeout: 5000
- click: "a:first-of-type"`

    const fullPrompt = `${sys}\n\nUser instruction: ${args.instruction}`

    this.log("🤖 Asking Claude...")
    
    try {
      const raw = await askClaude(fullPrompt)

      // 2) Clean up the output
      const yamlText = raw
        .replace(/```ya?ml/gi, "")
        .replace(/```/g, "")
        .replace(/^\s*#.*$/gm, "") // Remove comments
        .trim()
      
      // 3) Validate YAML structure
      try {
        const parsed = yaml.parse(yamlText)
        if (!Array.isArray(parsed)) {
          throw new Error("Workflow must be an array of steps")
        }
        
        // Validate each step
        parsed.forEach((step, index) => {
          if (typeof step !== 'object' || step === null) {
            throw new Error(`Step ${index + 1} must be an object`)
          }
          const commands = Object.keys(step)
          if (commands.length === 0) {
            throw new Error(`Step ${index + 1} must contain a command`)
          }
          if (commands.length > 1) {
            this.warn(`Step ${index + 1} contains multiple commands - only first will be executed`)
          }
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.error(`Invalid YAML generated: ${errorMessage}\n\nGenerated content:\n${yamlText}`)
      }

      if (flags["dry-run"] || flags.verbose) {
        this.log("\n--- GENERATED WORKFLOW ---\n")
        this.log(yamlText)
        this.log("\n--------------------------\n")
      }

      if (flags["dry-run"]) return

      // 4) Persist to a temp file & delegate to existing 'run' command
      const tmp = path.join(
        os.tmpdir(),
        `claude-workflow-${Date.now()}.yml`
      )
      await fs.writeFile(tmp, yamlText)

      // Forward base flags → we keep the same browser context
      const forwarded = {
        port: flags.port,
        host: flags.host,
        profile: flags.profile,
        headless: flags.headless,
        verbose: flags.verbose,
        keepOpen: flags.keepOpen,
      }

      // Execute it
      await Run.run(
        [
          tmp,                    // positional arg = file
          ...(forwarded.verbose ? ["--verbose"] : []),
          `--port=${forwarded.port}`,
          `--host=${forwarded.host}`,
          forwarded.keepOpen ? "--keepOpen" : "--no-keepOpen",
          forwarded.profile ? `--profile=${forwarded.profile}` : "",
          forwarded.headless ? "--headless" : "",
        ].filter(Boolean)
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Claude error: ${errorMessage}`)
    }
  }
}