import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import * as clipboardy from 'clipboardy'

export default class Select extends BaseCommand {
  static description = 'Find and inspect elements by CSS selector'

  static examples = [
    '<%= config.bin %> <%= command.id %> button',
    '<%= config.bin %> <%= command.id %> "a[href]"',
    '<%= config.bin %> <%= command.id %> ".my-class" --attributes',
    '<%= config.bin %> <%= command.id %> button --interactive',
    '<%= config.bin %> <%= command.id %> "input[type=text]" --limit 10',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    attributes: Flags.boolean({
      char: 'a',
      description: 'Include element attributes in output',
      default: false,
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Limit number of results',
      default: 50,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactively select an element and copy its selector to clipboard',
      default: false,
    }),
    visible: Flags.boolean({
      description: 'Only show visible elements',
      default: false,
    }),
  }

  static args = {
    selector: Args.string({
      description: 'CSS selector to find elements',
      required: true,
    }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Select)

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
      this.error('No page available')
    }

    try {
      // First check if any elements exist
      const count = await this.page!.locator(args.selector).count()
      
      if (count === 0) {
        this.log(`❌ No elements found matching "${args.selector}"`)
        return
      }

      this.log(`🔍 Found ${count} element(s) matching "${args.selector}"`)
      
      const limit = Math.min(count, flags.limit)
      if (count > flags.limit) {
        this.log(`📊 Showing first ${flags.limit} results (use --limit to change)`)
      }

      // Collect element information
      const elements = []
      for (let i = 0; i < limit; i++) {
        const locator = this.page!.locator(args.selector).nth(i)
        
        // Check visibility if flag is set
        if (flags.visible) {
          const isVisible = await locator.isVisible()
          if (!isVisible) continue
        }

        const elementInfo = await locator.evaluate((el, index) => {
          const rect = el.getBoundingClientRect()
          
          // Generate best selector for element
          function getBestSelector(element: Element): string {
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
            
            // Priority 3: Unique attribute
            const uniqueAttrs = ['name', 'type', 'placeholder', 'aria-label', 'data-testid']
            for (const attr of uniqueAttrs) {
              if (element.hasAttribute(attr)) {
                const value = element.getAttribute(attr)
                const selector = element.tagName.toLowerCase() + '[' + attr + '="' + value + '"]'
                if (document.querySelectorAll(selector).length === 1) {
                  return selector
                }
              }
            }
            
            // Priority 4: nth-of-type with parent context
            const parent = element.parentElement
            const siblings = parent ? Array.from(parent.children).filter(child => 
              child.tagName === element.tagName
            ) : []
            const indexInType = siblings.indexOf(element) + 1
            
            if (parent && parent.id) {
              return '#' + parent.id + ' > ' + element.tagName.toLowerCase() + ':nth-of-type(' + indexInType + ')'
            }
            
            if (parent && parent.className) {
              const parentClasses = parent.className.split(' ').filter(c => c.trim())
              const validParentClasses = parentClasses.filter(c => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c))
              if (validParentClasses.length > 0) {
                return '.' + validParentClasses[0] + ' > ' + element.tagName.toLowerCase() + ':nth-of-type(' + indexInType + ')'
              }
            }
            
            // Fallback: tag with index
            return element.tagName.toLowerCase() + ':nth-of-type(' + indexInType + ')'
          }
          
          const info: any = {
            index: index,
            tagName: el.tagName.toLowerCase(),
            selector: getBestSelector(el),
            textContent: el.textContent?.trim().substring(0, 100) || '',
            visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0,
            position: {
              top: Math.round(rect.top),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          }
          
          if (el.id) {
            info.id = el.id
          }
          
          if (el.className) {
            info.classes = el.className.split(' ').filter((c: string) => c.trim())
          }
          
          // Get attributes if requested
          const attrs: Record<string, string> = {}
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i]
            attrs[attr.name] = attr.value
          }
          info.attributes = attrs
          
          return info
        }, i)
        
        elements.push(elementInfo)
      }

      if (flags.interactive && elements.length > 0) {
        // Interactive mode - show selection menu
        const choices = elements.map((el: any) => {
          const visibilityIcon = el.visible ? '✓' : '✗'
          const text = el.textContent ? ` - "${el.textContent.substring(0, 50)}${el.textContent.length > 50 ? '...' : ''}"` : ''
          return {
            name: `[${el.index}] <${el.tagName}> ${visibilityIcon} ${el.selector}${text}`,
            value: el.selector,
            short: el.selector,
          }
        })
        
        const { select } = await import('@inquirer/prompts')
        const selectedSelector = await select({
          message: 'Select an element to copy its selector:',
          choices: choices.map(c => ({ name: c.name, value: c.value }))
        })
        
        try {
          await clipboardy.write(selectedSelector)
          this.log(`\n✅ Copied selector to clipboard: ${selectedSelector}`)
        } catch (error) {
          this.log(`\n❌ Failed to copy to clipboard: ${selectedSelector}`)
          this.log('  You can manually copy the selector above')
        }
      } else {
        // Regular output mode
        this.log('---')
        
        for (const el of elements) {
          this.log(`[${el.index}] <${el.tagName}> ${el.visible ? '✓ visible' : '✗ hidden'}`)
          this.log(`  Selector: ${el.selector}`)
          
          if (el.id) {
            this.log(`  ID: ${el.id}`)
          }
          
          if (el.classes && el.classes.length > 0) {
            this.log(`  Classes: ${el.classes.join(', ')}`)
          }
          
          if (el.textContent) {
            this.log(`  Text: "${el.textContent}"`)
          }
          
          this.log(`  Position: ${el.position.left}x${el.position.top} (${el.position.width}x${el.position.height})`)
          
          if (flags.attributes && el.attributes && Object.keys(el.attributes).length > 0) {
            this.log('  Attributes:')
            for (const [key, value] of Object.entries(el.attributes)) {
              if (key !== 'id' && key !== 'class') {
                this.log(`    ${key}: "${value}"`)
              }
            }
          }
          
          this.log('')
        }
      }

      // Log summary if verbose
      if (flags.verbose) {
        const visibleCount = elements.filter((el: any) => el.visible).length
        this.logVerbose('Element summary', {
          total: count,
          shown: elements.length,
          visible: visibleCount,
          hidden: elements.length - visibleCount,
        })
      }
    } catch (error: any) {
      this.error(`Failed to select elements: ${error.message}`)
    }
  }
}