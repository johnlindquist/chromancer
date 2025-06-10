import {Flags} from '@oclif/core'
import {Page} from 'puppeteer-core'
import {BaseCommand} from '../base.js'

export default class Assert extends BaseCommand {
  static description = 'Assert conditions about page elements or JavaScript expressions'

  static examples = [
    '<%= config.bin %> <%= command.id %> --selector "#success-message"',
    '<%= config.bin %> <%= command.id %> --selector "h1" --contains "Welcome"',
    '<%= config.bin %> <%= command.id %> --eval "document.title" --equals "My Page"',
    '<%= config.bin %> <%= command.id %> --selector ".items" --count 5',
    '<%= config.bin %> <%= command.id %> --eval "window.location.pathname" --equals "/checkout"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    selector: Flags.string({
      char: 's',
      description: 'CSS selector to assert on',
      exclusive: ['eval'],
    }),
    eval: Flags.string({
      char: 'e',
      description: 'JavaScript expression to evaluate and assert',
      exclusive: ['selector'],
    }),
    contains: Flags.string({
      description: 'Assert element text contains this value',
      exclusive: ['equals', 'matches'],
    }),
    equals: Flags.string({
      description: 'Assert element text or evaluation result equals this value',
      exclusive: ['contains', 'matches'],
    }),
    matches: Flags.string({
      description: 'Assert element text matches this regex pattern',
      exclusive: ['contains', 'equals'],
    }),
    count: Flags.string({
      description: 'Assert number of elements matching selector',
      dependsOn: ['selector'],
      exclusive: ['contains', 'equals', 'matches', 'visible', 'not-visible', 'value'],
    }),
    visible: Flags.boolean({
      description: 'Assert element is visible',
      dependsOn: ['selector'],
      exclusive: ['not-visible', 'count'],
    }),
    'not-visible': Flags.boolean({
      description: 'Assert element is not visible',
      dependsOn: ['selector'],
      exclusive: ['visible', 'count'],
    }),
    value: Flags.string({
      description: 'Assert input element value',
      dependsOn: ['selector'],
      exclusive: ['contains', 'equals', 'matches', 'count'],
    }),
    message: Flags.string({
      char: 'm',
      description: 'Custom error message if assertion fails',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Assert)
    
    await this.connectToChrome(flags.port, flags.host, flags.launch, flags.verbose, flags.keepOpen)
    
    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    await this.executeCommand(this.page, flags)
  }

  private async executeCommand(page: Page, flags: any): Promise<void> {
    try {
      if (flags.selector) {
        await this.assertSelector(page, flags)
      } else if (flags.eval) {
        await this.assertEvaluation(page, flags)
      } else {
        this.error('Either --selector or --eval must be specified')
      }
    } catch (error: any) {
      const message = flags.message || error.message
      this.error(`Assertion failed: ${message}`)
    }
  }

  private async assertSelector(page: Page, flags: any): Promise<void> {
    const selector = flags.selector
    
    // Check if element exists
    const elements = await page.$$(selector)
    
    if (elements.length === 0) {
      throw new Error(`Element not found: ${selector}`)
    }
    
    // Handle count assertion
    if (flags.count !== undefined) {
      const expectedCount = parseInt(flags.count)
      if (elements.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} elements, found ${elements.length}`)
      }
      this.log(`✓ Assertion passed: Element count equals ${expectedCount}`)
      return
    }
    
    // Handle visibility assertions
    if (flags.visible || flags['not-visible']) {
      const isVisible = await page.evaluate(`
        (() => {
          const el = document.querySelector("${selector.replace(/"/g, '\\"')}");
          if (!el) return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        })()
      `)
      
      if (flags.visible && !isVisible) {
        throw new Error(`Element is not visible: ${selector}`)
      }
      if (flags['not-visible'] && isVisible) {
        throw new Error(`Element is visible: ${selector}`)
      }
      
      this.log(`✓ Assertion passed: Element is ${flags.visible ? 'visible' : 'not visible'}`)
      return
    }
    
    // Get element content for text assertions
    const element = elements[0]
    let content: string
    
    if (flags.value !== undefined) {
      // Get input value
      content = await page.evaluate(el => (el as any).value || '', element)
      
      if (content !== flags.value) {
        throw new Error(`Input value "${content}" does not equal "${flags.value}"`)
      }
      this.log(`✓ Assertion passed: Input value equals "${flags.value}"`)
      return
    } else {
      // Get text content
      content = await page.evaluate(el => el.textContent?.trim() || '', element)
    }
    
    // Handle text assertions
    if (flags.contains) {
      if (!content.includes(flags.contains)) {
        throw new Error(`Element text "${content}" does not contain "${flags.contains}"`)
      }
      this.log(`✓ Assertion passed: Element text contains "${flags.contains}"`)
    } else if (flags.equals) {
      if (content !== flags.equals) {
        throw new Error(`Element text "${content}" does not equal "${flags.equals}"`)
      }
      this.log(`✓ Assertion passed: Element text equals "${flags.equals}"`)
    } else if (flags.matches) {
      const regex = new RegExp(flags.matches)
      if (!regex.test(content)) {
        throw new Error(`Element text "${content}" does not match pattern "${flags.matches}"`)
      }
      this.log(`✓ Assertion passed: Element text matches pattern "${flags.matches}"`)
    } else {
      // Just check element exists
      this.log(`✓ Assertion passed: Element exists: ${selector}`)
    }
  }

  private async assertEvaluation(page: Page, flags: any): Promise<void> {
    let result: any
    
    try {
      result = await page.evaluate(flags.eval)
    } catch (error: any) {
      throw new Error(`Failed to evaluate expression: ${error.message}`)
    }
    
    // Convert result to string for comparison if needed
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
    
    if (flags.contains) {
      if (!resultStr.includes(flags.contains)) {
        throw new Error(`Result "${resultStr}" does not contain "${flags.contains}"`)
      }
      this.log(`✓ Assertion passed: Evaluation result contains "${flags.contains}"`)
    } else if (flags.equals) {
      const expectedStr = flags.equals
      if (resultStr !== expectedStr && result !== flags.equals) {
        throw new Error(`Result "${resultStr}" does not equal "${expectedStr}"`)
      }
      this.log(`✓ Assertion passed: Evaluation result equals "${flags.equals}"`)
    } else if (flags.matches) {
      const regex = new RegExp(flags.matches)
      if (!regex.test(resultStr)) {
        throw new Error(`Result "${resultStr}" does not match pattern "${flags.matches}"`)
      }
      this.log(`✓ Assertion passed: Evaluation result matches pattern "${flags.matches}"`)
    } else {
      // For boolean expressions without comparison
      if (result === false || result === null || result === undefined) {
        throw new Error(`Expression evaluated to ${result}`)
      }
      this.log(`✓ Assertion passed: Expression evaluated to ${result}`)
    }
  }
}