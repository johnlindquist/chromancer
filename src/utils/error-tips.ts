import { CommandError } from './errors.js'

// Create a chalk-like interface for colorization
const chalk = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  redBright: (s: string) => `\x1b[91m${s}\x1b[0m`,
}

export interface ErrorTip {
  message: string
  tip?: string
  example?: string
  docsLink?: string
}

/**
 * Get actionable tips for common errors
 */
export function getErrorTip(error: CommandError | Error, command?: string): ErrorTip {
  const message = error.message.toLowerCase()
  const selector = (error as CommandError).selector
  
  // Selector-related errors
  if (message.includes('element not found') || message.includes('no element matches selector')) {
    return getSelectorErrorTip(selector, message)
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('waiting failed')) {
    return getTimeoutErrorTip(selector, command, message)
  }
  
  // Navigation errors
  if (message.includes('navigation') || message.includes('goto')) {
    return getNavigationErrorTip(message)
  }
  
  // Click errors
  if (message.includes('click') && message.includes('intercept')) {
    return {
      message: 'Element is covered by another element',
      tip: 'The element might be hidden behind a modal, popup, or overlay',
      example: 'chromancer wait --selector ".modal" --hidden\nchromancer click "#submit"',
    }
  }
  
  // Type errors
  if (message.includes('cannot type') || message.includes('not an input')) {
    return {
      message: 'Element is not an input field',
      tip: 'Make sure you\'re targeting an <input>, <textarea>, or contenteditable element',
      example: 'chromancer type "input[name=\'email\']" "test@example.com"',
    }
  }
  
  // Frame errors
  if (message.includes('frame') || message.includes('iframe')) {
    return {
      message: 'Element might be inside an iframe',
      tip: 'Use --frame option to target elements inside iframes',
      example: 'chromancer click "#button" --frame 0',
    }
  }
  
  // Connection errors
  if (message.includes('connect') || message.includes('connection refused')) {
    return {
      message: 'Cannot connect to Chrome',
      tip: 'Make sure Chrome is running with remote debugging enabled',
      example: 'chromancer spawn --headless\n# Or manually: chrome --remote-debugging-port=9222',
    }
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('access denied')) {
    return {
      message: 'Permission denied',
      tip: 'Check file permissions or try running with appropriate privileges',
    }
  }
  
  // Default tip
  return {
    message: error.message,
    tip: 'Check the command syntax and ensure the page has loaded completely',
  }
}

function getSelectorErrorTip(selector?: string, message?: string): ErrorTip {
  if (!selector) {
    return {
      message: 'Element not found',
      tip: 'Provide a valid CSS selector',
      example: 'chromancer click ".button-class"\nchromancer click "#button-id"',
    }
  }
  
  // Check for common selector mistakes
  if (selector.includes('//')) {
    return {
      message: `XPath selectors are not supported: ${selector}`,
      tip: 'Use CSS selectors instead of XPath',
      example: 'chromancer click "button[contains(text(), \'Submit\')]"',
    }
  }
  
  if (selector.match(/^[a-zA-Z]+$/) && !['html', 'body', 'head'].includes(selector)) {
    return {
      message: `Element not found: ${selector}`,
      tip: `Did you forget to add a class (.) or ID (#) prefix?`,
      example: `chromancer click ".${selector}" # for class\nchromancer click "#${selector}" # for ID`,
    }
  }
  
  if (selector.includes(':contains')) {
    return {
      message: 'The :contains() pseudo-selector is not standard CSS',
      tip: 'Use text-based selectors or Playwright\'s text locators',
      example: 'chromancer click "button:has-text(\'Submit\')"',
    }
  }
  
  if (selector.startsWith('.') && selector.includes(' ')) {
    return {
      message: `Element not found: ${selector}`,
      tip: 'Spaces in class selectors might be an issue. Try using dots for multiple classes',
      example: `chromancer click "${selector.replace(/ /g, '.')}"`,
    }
  }
  
  return {
    message: `Element not found: ${selector}`,
    tip: 'Ensure the element exists and is not hidden. Try waiting for it first',
    example: `chromancer wait --selector "${selector}"\nchromancer click "${selector}"`,
  }
}

function getTimeoutErrorTip(selector?: string, command?: string, message?: string): ErrorTip {
  if (message?.includes('navigation')) {
    return {
      message: 'Navigation timeout',
      tip: 'The page took too long to load. Try different wait conditions',
      example: 'chromancer navigate "https://example.com" --wait-until domcontentloaded\n# Or: --wait-until networkidle',
    }
  }
  
  if (selector) {
    return {
      message: `Timeout waiting for element: ${selector}`,
      tip: 'The element didn\'t appear within the timeout period',
      example: `# Increase timeout:\nchromancer wait --selector "${selector}" --timeout 60000\n\n# Or check if element is in iframe:\nchromancer wait --selector "${selector}" --frame 0`,
    }
  }
  
  return {
    message: 'Operation timed out',
    tip: 'Try increasing the timeout or checking network conditions',
    example: 'chromancer <command> --timeout 60000',
  }
}

function getNavigationErrorTip(message: string): ErrorTip {
  if (message.includes('invalid url') || message.includes('malformed')) {
    return {
      message: 'Invalid URL',
      tip: 'Make sure the URL includes the protocol (http:// or https://)',
      example: 'chromancer navigate "https://example.com"',
    }
  }
  
  if (message.includes('net::err') || message.includes('failed to load')) {
    return {
      message: 'Failed to load page',
      tip: 'Check your internet connection and verify the URL is accessible',
      example: '# Test with a known working site:\nchromancer navigate "https://google.com"',
    }
  }
  
  return {
    message: 'Navigation failed',
    tip: 'Try using different wait conditions or check if the site requires authentication',
    example: 'chromancer navigate "https://example.com" --wait-until networkidle',
  }
}

/**
 * Format and display error with tips
 */
export function displayErrorWithTip(
  error: CommandError | Error, 
  command?: string,
  docsBaseUrl: string = 'https://chromancer.dev/docs'
): void {
  const tip = getErrorTip(error, command)
  
  // Error message
  console.error(chalk.red('❌ ' + tip.message))
  
  // Tip
  if (tip.tip) {
    console.error(chalk.yellow('\n💡 Tip: ' + tip.tip))
  }
  
  // Example
  if (tip.example) {
    console.error(chalk.gray('\nExample:'))
    tip.example.split('\n').forEach(line => {
      console.error(chalk.gray('   ' + line))
    })
  }
  
  // Docs link
  if (command) {
    const docsLink = `${docsBaseUrl}/${command}#errors`
    console.error(chalk.blue('\n📚 Docs: ' + docsLink))
  }
}

/**
 * Enhance error messages in BaseCommand
 */
export function enhanceError(error: Error, context?: { command?: string, selector?: string }): Error {
  const tip = getErrorTip(error, context?.command)
  
  // Create enhanced error message
  let enhancedMessage = tip.message
  if (tip.tip) {
    enhancedMessage += `\n💡 ${tip.tip}`
  }
  
  const enhancedError = new Error(enhancedMessage)
  enhancedError.stack = error.stack
  
  return enhancedError
}