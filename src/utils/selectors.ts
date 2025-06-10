import { Page, ElementHandle } from 'puppeteer-core'

export interface WaitOptions {
  timeout?: number
  visible?: boolean
  hidden?: boolean
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
  const { timeout = 30000, visible, hidden } = options
  
  try {
    const element = await page.waitForSelector(selector, {
      timeout,
      visible,
      hidden,
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
  return page.evaluate(`
    (() => {
      const element = document.querySelector("${selector.replace(/"/g, '\\"')}");
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= 0 &&
        rect.left >= 0
      );
    })()
  `) as Promise<boolean>
}

/**
 * Get comprehensive information about an element
 */
export async function getElementInfo(page: Page, selector: string): Promise<ElementInfo | null> {
  const element = await page.$(selector)
  if (!element) return null
  
  return page.evaluate((el: any) => {
    const style = (window as any).getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    
    const info: any = {
      text: el.textContent?.trim() || '',
      value: el.value || '',
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
      isDisabled: el.disabled || false,
    }
    
    // Add element-specific properties
    if (el.tagName === 'A') {
      info.href = el.href
    }
    
    if (el.tagName === 'INPUT') {
      info.type = el.type
      info.placeholder = el.placeholder
    }
    
    return info
  }, element)
}