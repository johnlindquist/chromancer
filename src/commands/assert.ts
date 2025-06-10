import { Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'
import { safeEvaluate } from '../utils/evaluation.js'
import Store from './store.js'

export default class Assert extends BaseCommand {
  static description = 'Assert conditions about page elements or JavaScript expressions'

  static examples = [
    '<%= config.bin %> <%= command.id %> --selector "#success-message"',
    '<%= config.bin %> <%= command.id %> --selector "h1" --contains "Welcome"',
    '<%= config.bin %> <%= command.id %> --eval "document.title" --equals "My Page"',
    '<%= config.bin %> <%= command.id %> --selector ".items" --count 5',
    '<%= config.bin %> <%= command.id %> --eval "window.location.pathname" --equals "/checkout"',
    '<%= config.bin %> <%= command.id %> --stored "originalPrice" --equals "99.99"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    selector: Flags.string({
      char: 's',
      description: 'CSS selector to assert on',
      exclusive: ['eval', 'stored'],
    }),
    eval: Flags.string({
      char: 'e',
      description: 'JavaScript expression to evaluate and assert',
      exclusive: ['selector', 'stored'],
    }),
    stored: Flags.string({
      description: 'Assert on a previously stored value',
      exclusive: ['selector', 'eval'],
    }),
    contains: Flags.string({
      description: 'Assert element text contains this value',
      exclusive: ['equals', 'matches', 'greater-than', 'less-than'],
    }),
    equals: Flags.string({
      description: 'Assert element text or evaluation result equals this value',
      exclusive: ['contains', 'matches', 'greater-than', 'less-than'],
    }),
    matches: Flags.string({
      description: 'Assert element text matches this regex pattern',
      exclusive: ['contains', 'equals', 'greater-than', 'less-than'],
    }),
    'greater-than': Flags.string({
      description: 'Assert numeric value is greater than this',
      exclusive: ['contains', 'equals', 'matches', 'less-than'],
    }),
    'less-than': Flags.string({
      description: 'Assert numeric value is less than this',
      exclusive: ['contains', 'equals', 'matches', 'greater-than'],
    }),
    count: Flags.string({
      description: 'Assert number of elements matching selector',
      dependsOn: ['selector'],
      exclusive: ['contains', 'equals', 'matches', 'visible', 'not-visible', 'value', 'greater-than', 'less-than'],
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
    const { flags } = await this.parse(Assert)
    
    // For stored value assertions, we may not need Chrome connection
    if (flags.stored && !flags.eval && !flags.selector) {
      await this.assertStoredValue(flags)
      return
    }
    
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

    await this.executeCommand(this.page!, flags)
  }

  private async executeCommand(page: Page, flags: any): Promise<void> {
    try {
      if (flags.selector) {
        await this.assertSelector(page, flags)
      } else if (flags.eval) {
        await this.assertEvaluation(page, flags)
      } else if (flags.stored) {
        await this.assertStoredValue(flags)
      } else {
        this.error('Either --selector, --eval, or --stored must be specified')
      }
    } catch (error: any) {
      const message = flags.message || error.message
      this.error(`❌ Assertion failed: ${message}`)
    }
  }

  private async assertSelector(page: Page, flags: any): Promise<void> {
    const selector = flags.selector
    
    // Check if element exists
    const count = await page.locator(selector).count()
    
    if (count === 0 && !flags['not-visible']) {
      throw new Error(`Element not found: ${selector}`)
    }
    
    // Handle count assertion
    if (flags.count !== undefined) {
      const expectedCount = parseInt(flags.count)
      if (count !== expectedCount) {
        throw new Error(`Expected ${expectedCount} elements, found ${count}`)
      }
      this.log(`✅ Assertion passed: Element count equals ${expectedCount}`)
      return
    }
    
    // Handle visibility assertions
    if (flags.visible || flags['not-visible']) {
      const locator = page.locator(selector).first()
      const isVisible = count > 0 && await locator.isVisible()
      
      if (flags.visible && !isVisible) {
        throw new Error(`Element is not visible: ${selector}`)
      }
      if (flags['not-visible'] && isVisible) {
        throw new Error(`Element is visible: ${selector}`)
      }
      
      this.log(`✅ Assertion passed: Element is ${flags.visible ? 'visible' : 'not visible'}`)
      return
    }
    
    // Get element content for text assertions
    const element = page.locator(selector).first()
    let content: string
    
    if (flags.value !== undefined) {
      // Get input value
      content = await element.inputValue() || ''
      
      if (content !== flags.value) {
        throw new Error(`Input value "${content}" does not equal "${flags.value}"`)
      }
      this.log(`✅ Assertion passed: Input value equals "${flags.value}"`)
      return
    } else {
      // Get text content
      content = await element.textContent() || ''
      content = content.trim()
    }
    
    // Handle text assertions
    this.assertContent(content, flags, `Element text`)
  }

  private async assertEvaluation(page: Page, flags: any): Promise<void> {
    let result: any
    
    result = await safeEvaluate(page, flags.eval)
    
    // Convert result to string for comparison if needed
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
    
    this.assertContent(resultStr, flags, `Evaluation result`, result)
  }

  private async assertStoredValue(flags: any): Promise<void> {
    const value = Store.getStoredValue(flags.stored)
    
    if (value === undefined) {
      throw new Error(`No stored value found for: ${flags.stored}`)
    }
    
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
    
    this.assertContent(valueStr, flags, `Stored value "${flags.stored}"`, value)
  }

  private assertContent(content: string, flags: any, prefix: string, rawValue?: any): void {
    if (flags.contains) {
      if (!content.includes(flags.contains)) {
        throw new Error(`${prefix} "${content}" does not contain "${flags.contains}"`)
      }
      this.log(`✅ Assertion passed: ${prefix} contains "${flags.contains}"`)
    } else if (flags.equals) {
      // For equals, also check raw value if available
      const expectedStr = flags.equals
      if (content !== expectedStr && rawValue !== flags.equals) {
        // Try numeric comparison if both can be parsed as numbers
        const numContent = parseFloat(content)
        const numExpected = parseFloat(expectedStr)
        if (isNaN(numContent) || isNaN(numExpected) || numContent !== numExpected) {
          throw new Error(`${prefix} "${content}" does not equal "${expectedStr}"`)
        }
      }
      this.log(`✅ Assertion passed: ${prefix} equals "${flags.equals}"`)
    } else if (flags.matches) {
      const regex = new RegExp(flags.matches)
      if (!regex.test(content)) {
        throw new Error(`${prefix} "${content}" does not match pattern "${flags.matches}"`)
      }
      this.log(`✅ Assertion passed: ${prefix} matches pattern "${flags.matches}"`)
    } else if (flags['greater-than']) {
      const numContent = parseFloat(content)
      const numThreshold = parseFloat(flags['greater-than'])
      if (isNaN(numContent) || isNaN(numThreshold)) {
        throw new Error(`Cannot compare non-numeric values: "${content}" > "${flags['greater-than']}"`)
      }
      if (numContent <= numThreshold) {
        throw new Error(`${prefix} ${numContent} is not greater than ${numThreshold}`)
      }
      this.log(`✅ Assertion passed: ${prefix} (${numContent}) is greater than ${numThreshold}`)
    } else if (flags['less-than']) {
      const numContent = parseFloat(content)
      const numThreshold = parseFloat(flags['less-than'])
      if (isNaN(numContent) || isNaN(numThreshold)) {
        throw new Error(`Cannot compare non-numeric values: "${content}" < "${flags['less-than']}"`)
      }
      if (numContent >= numThreshold) {
        throw new Error(`${prefix} ${numContent} is not less than ${numThreshold}`)
      }
      this.log(`✅ Assertion passed: ${prefix} (${numContent}) is less than ${numThreshold}`)
    } else {
      // For boolean expressions without comparison
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        throw new Error(`Expression evaluated to ${rawValue}`)
      }
      this.log(`✅ Assertion passed: ${prefix} exists${rawValue !== undefined ? ` (${content})` : ''}`)
    }
    
    // Log details if verbose
    if (flags.verbose) {
      this.logVerbose('Assertion details', {
        type: prefix,
        content: content,
        rawValue: rawValue,
        assertion: flags.contains ? 'contains' : 
                   flags.equals ? 'equals' : 
                   flags.matches ? 'matches' :
                   flags['greater-than'] ? 'greater-than' :
                   flags['less-than'] ? 'less-than' : 'exists'
      })
    }
  }
}