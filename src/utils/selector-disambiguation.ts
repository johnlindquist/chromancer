import { Page } from 'playwright'

export interface ElementMatch {
  index: number
  selector: string
  tagName: string
  textContent: string
  visible: boolean
  id?: string
  classes?: string[]
  position: {
    top: number
    left: number
    width: number
    height: number
  }
}

/**
 * Check if a selector matches multiple elements and return disambiguation info
 */
export async function checkMultipleMatches(
  page: Page, 
  selector: string
): Promise<{ count: number; elements?: ElementMatch[] }> {
  const count = await page.locator(selector).count()
  
  if (count <= 1) {
    return { count }
  }

  // Get info about first few matches for disambiguation
  const elements: ElementMatch[] = []
  const limit = Math.min(count, 10) // Show max 10 options
  
  for (let i = 0; i < limit; i++) {
    const locator = page.locator(selector).nth(i)
    
    const elementInfo = await locator.evaluate((el, index) => {
      const rect = el.getBoundingClientRect()
      
      // Generate unique selector for this specific element
      function getUniqueSelector(element: Element): string {
        // Priority 1: ID
        if (element.id) {
          return '#' + element.id
        }
        
        // Priority 2: Unique class combination
        if (element.className) {
          const classes = element.className.split(' ').filter(c => c.trim())
          const validClasses = classes.filter(c => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c))
          
          if (validClasses.length > 0) {
            const firstClassSelector = '.' + validClasses[0]
            if (document.querySelectorAll(firstClassSelector).length === 1) {
              return firstClassSelector
            }
            
            // Try combination of classes
            for (let i = 2; i <= Math.min(validClasses.length, 3); i++) {
              const classSelector = '.' + validClasses.slice(0, i).join('.')
              try {
                if (document.querySelectorAll(classSelector).length === 1) {
                  return classSelector
                }
              } catch (e) {
                // Invalid selector, skip
              }
            }
          }
        }
        
        // Priority 3: nth-child based on original selector
        const parent = element.parentElement
        if (parent) {
          const siblings = Array.from(parent.querySelectorAll(':scope > ' + element.tagName))
          const index = siblings.indexOf(element) + 1
          return `${element.tagName.toLowerCase()}:nth-child(${index})`
        }
        
        // Fallback: Use nth-of-type
        return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`
      }
      
      return {
        index: index,
        selector: getUniqueSelector(el),
        tagName: el.tagName.toLowerCase(),
        textContent: el.textContent?.trim().substring(0, 50) || '',
        visible: rect.width > 0 && rect.height > 0,
        id: el.id || undefined,
        classes: el.className ? el.className.split(' ').filter((c: string) => c.trim()) : undefined,
        position: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      }
    }, i)
    
    elements.push(elementInfo)
  }
  
  return { count, elements }
}

/**
 * Format element matches for display
 */
export function formatElementMatches(elements: ElementMatch[]): string {
  const lines: string[] = []
  
  lines.push(`Found ${elements.length} elements. Please use a more specific selector:`)
  lines.push('---')
  
  for (const el of elements) {
    const visibilityIcon = el.visible ? '✓ visible' : '✗ hidden'
    const text = el.textContent ? ` - "${el.textContent}"` : ''
    
    lines.push(`[${el.index}] <${el.tagName}> ${visibilityIcon}`)
    lines.push(`  Suggested selector: ${el.selector}`)
    
    if (el.id) {
      lines.push(`  ID: ${el.id}`)
    }
    
    if (el.classes && el.classes.length > 0) {
      lines.push(`  Classes: ${el.classes.join(', ')}`)
    }
    
    if (text) {
      lines.push(`  Text: ${text}`)
    }
    
    lines.push(`  Position: ${el.position.left}x${el.position.top}`)
    lines.push('')
  }
  
  return lines.join('\n')
}

/**
 * Get interactive selection from user (requires inquirer)
 */
export async function getInteractiveSelection(elements: ElementMatch[]): Promise<string | null> {
  try {
    const inquirer = await import('inquirer')
    
    const choices = elements.map((el) => {
      const visibilityIcon = el.visible ? '✓' : '✗'
      const text = el.textContent ? ` - "${el.textContent}"` : ''
      return {
        name: `[${el.index}] <${el.tagName}> ${visibilityIcon} ${el.selector}${text}`,
        value: el.selector,
        short: el.selector,
      }
    })
    
    const { selectedSelector } = await inquirer.default.prompt([
      {
        type: 'list',
        name: 'selectedSelector',
        message: 'Multiple elements found. Select one:',
        choices,
        pageSize: 10,
      },
    ])
    
    return selectedSelector
  } catch (error) {
    // If interactive mode fails, return null
    return null
  }
}