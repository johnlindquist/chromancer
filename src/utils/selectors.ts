import { Page, Locator, ElementHandle } from 'playwright'

export interface WaitOptions {
  timeout?: number
  state?: 'attached' | 'detached' | 'visible' | 'hidden'
}

export interface ElementInfo {
  text: string
  value: string
  tagName: string
  id: string
  className: string
  isVisible: boolean
  isDisabled: boolean
  href?: string | null
  type?: string
  placeholder?: string
  [key: string]: any
}

/**
 * Wait for an element to appear on the page
 */
export async function waitForElement(
  page: Page, 
  selector: string, 
  options: WaitOptions = {}
): Promise<ElementHandle> {
  const { timeout = 30000, state = 'attached' } = options
  
  try {
    // In Playwright, we use waitForSelector which returns ElementHandle or null
    const element = await page.waitForSelector(selector, {
      timeout,
      state,
    })
    
    if (!element) {
      throw new Error(`Element not found: ${selector}`)
    }
    
    return element
  } catch (error: any) {
    if (error.message?.includes('Timeout') || error.message?.includes('Waiting failed')) {
      throw new Error(`Element not found: ${selector}`)
    }
    throw error
  }
}

/**
 * Check if an element is visible on the page
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.$(selector)
    if (!element) return false
    
    return await element.isVisible()
  } catch {
    return false
  }
}

/**
 * Get comprehensive information about an element
 */
export async function getElementInfo(page: Page, selector: string): Promise<ElementInfo | null> {
  const element = await page.$(selector)
  if (!element) return null
  
  return await element.evaluate((el: HTMLElement) => {
    const style = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    
    const info: any = {
      text: el.textContent?.trim() || '',
      value: (el as any).value || '',
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      isVisible: (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      ),
      isDisabled: (el as any).disabled || false,
    }
    
    // Add element-specific properties
    if (el.tagName === 'A') {
      info.href = (el as HTMLAnchorElement).href
    }
    
    if (el.tagName === 'INPUT') {
      info.type = (el as HTMLInputElement).type
      info.placeholder = (el as HTMLInputElement).placeholder
    }
    
    return info
  })
}