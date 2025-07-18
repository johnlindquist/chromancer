import { Page, ElementHandle } from 'playwright'

/**
 * Safely evaluate JavaScript in the page context with error handling
 */
export async function safeEvaluate<T = any>(
  page: Page,
  pageFunction: string | Function,
  ...args: any[]
): Promise<T> {
  try {
    return await page.evaluate(pageFunction as any, ...args) as T
  } catch (error: any) {
    if (error.name === 'SyntaxError') {
      throw new Error(`Invalid JavaScript expression: ${error.message}`)
    }
    throw new Error(`Failed to evaluate: ${error.message}`)
  }
}

/**
 * Get a single property from an element
 */
export async function evaluateElementProperty(
  element: ElementHandle,
  property: string
): Promise<any> {
  return element.evaluate((el, prop) => {
    return (el as any)[prop]
  }, property)
}

/**
 * Get multiple properties from an element at once
 */
export async function evaluateElementProperties(
  element: ElementHandle,
  properties?: string[]
): Promise<Record<string, any>> {
  const defaultProperties = [
    'textContent',
    'value',
    'id',
    'className',
    'tagName',
    'href',
  ]
  
  const props = properties || defaultProperties
  
  return element.evaluate((el, propList) => {
    const result: Record<string, any> = {}
    
    for (const prop of propList) {
      result[prop] = (el as any)[prop] || null
    }
    
    return result
  }, props)
}