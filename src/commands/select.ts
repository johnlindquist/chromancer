import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base'

export default class Select extends BaseCommand {
  static description = 'Find and inspect elements by CSS selector'

  static examples = [
    '<%= config.bin %> <%= command.id %> button',
    '<%= config.bin %> <%= command.id %> "a[href]"',
    '<%= config.bin %> <%= command.id %> ".my-class" --port 9223',
    '<%= config.bin %> <%= command.id %> "#my-id" --launch',
    '<%= config.bin %> <%= command.id %> "input[type=text]" --attributes',
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
  }

  static args = {
    selector: Args.string({
      description: 'CSS selector to find elements',
      required: true,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Select)

    await this.connectToChrome(flags.port, flags.host, flags.launch, flags.verbose, flags.keepOpen)

    if (!this.page) {
      this.error('No page available')
    }

    try {
      const elements: any = await this.page.evaluate(`
        (function(selector, showAttributes, limit) {
          const matches = document.querySelectorAll(selector)
          const results = []
          
          for (let i = 0; i < Math.min(matches.length, limit); i++) {
            const el = matches[i]
            const rect = el.getBoundingClientRect()
            
            // Generate best selector for element
            function getBestSelector(element) {
              // Priority 1: ID
              if (element.id) {
                return '#' + element.id
              }
              
              // Priority 2: Unique class combination (skip classes with special chars)
              if (element.className) {
                const classes = element.className.split(' ').filter(c => c.trim())
                // Only use classes that are valid CSS identifiers
                const validClasses = classes.filter(c => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c))
                
                if (validClasses.length > 0) {
                  // Try first class alone
                  const firstClassSelector = '.' + validClasses[0]
                  if (document.querySelectorAll(firstClassSelector).length === 1) {
                    return firstClassSelector
                  }
                  
                  // Try combination of first few valid classes
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
              const index = siblings.indexOf(element) + 1
              
              if (parent && parent.id) {
                return '#' + parent.id + ' > ' + element.tagName.toLowerCase() + ':nth-of-type(' + index + ')'
              }
              
              if (parent && parent.className) {
                const parentClasses = parent.className.split(' ').filter(c => c.trim())
                const validParentClasses = parentClasses.filter(c => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c))
                if (validParentClasses.length > 0) {
                  return '.' + validParentClasses[0] + ' > ' + element.tagName.toLowerCase() + ':nth-of-type(' + index + ')'
                }
              }
              
              // Fallback: tag with index
              return element.tagName.toLowerCase() + ':nth-of-type(' + index + ')'
            }
            
            const elementInfo = {
              index: i,
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
            
            if (showAttributes) {
              const attrs = {}
              for (const attr of el.attributes) {
                attrs[attr.name] = attr.value
              }
              elementInfo.attributes = attrs
            }
            
            if (el.id) {
              elementInfo.id = el.id
            }
            
            if (el.className) {
              elementInfo.classes = el.className.split(' ').filter(c => c.trim())
            }
            
            results.push(elementInfo)
          }
          
          return {
            total: matches.length,
            results,
          }
        })(${JSON.stringify(args.selector)}, ${flags.attributes}, ${flags.limit})
      `)
      
      this.log(`Found ${elements.total} element(s) matching "${args.selector}"`)
      
      if (elements.total === 0) {
        return
      }
      
      if (elements.total > flags.limit) {
        this.log(`Showing first ${flags.limit} results (use --limit to change)`)
      }
      
      this.log('---')
      
      for (const el of elements.results) {
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
    } catch (error: any) {
      this.error(`Failed to select elements: ${error.message}`)
    }
  }
}