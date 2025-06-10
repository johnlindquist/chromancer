import { Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'
import { promises as fs } from 'fs'
import * as path from 'path'

export default class Export extends BaseCommand {
  static description = 'Export page content, data, or resources'

  static examples = [
    '<%= config.bin %> <%= command.id %> --format html --output page.html',
    '<%= config.bin %> <%= command.id %> --format json --selector "table#data"',
    '<%= config.bin %> <%= command.id %> --format csv --selector "table"',
    '<%= config.bin %> <%= command.id %> --format markdown --output content.md',
    '<%= config.bin %> <%= command.id %> --all-resources --output-dir ./export',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    format: Flags.string({
      char: 'f',
      description: 'Export format',
      options: ['html', 'json', 'csv', 'markdown', 'text'],
      default: 'html',
    }),
    selector: Flags.string({
      char: 's',
      description: 'CSS selector to export specific element',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path',
    }),
    'output-dir': Flags.string({
      description: 'Output directory for resources',
      default: './export',
    }),
    'all-resources': Flags.boolean({
      description: 'Export all page resources (images, scripts, styles)',
      default: false,
    }),
    'include-styles': Flags.boolean({
      description: 'Include computed styles in HTML export',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Export)
    
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

    await this.exportContent(this.page!)
  }

  private async exportContent(page: Page): Promise<void> {
    const { flags } = await this.parse(Export)
    
    let content: string
    
    switch (flags.format) {
      case 'html':
        content = await this.exportHTML(page, flags.selector, flags['include-styles'])
        break
      case 'json':
        content = await this.exportJSON(page, flags.selector)
        break
      case 'csv':
        content = await this.exportCSV(page, flags.selector)
        break
      case 'markdown':
        content = await this.exportMarkdown(page, flags.selector)
        break
      case 'text':
        content = await this.exportText(page, flags.selector)
        break
      default:
        this.error(`Unsupported format: ${flags.format}`)
    }
    
    // Export resources if requested
    if (flags['all-resources']) {
      await this.exportResources(page, flags['output-dir'])
    }
    
    // Save content
    const outputPath = flags.output || `export.${flags.format}`
    await fs.writeFile(outputPath, content)
    this.log(`✅ Exported to: ${outputPath}`)
  }

  private async exportHTML(page: Page, selector?: string, includeStyles?: boolean): Promise<string> {
    if (selector) {
      return await page.evaluate(({ sel, styles }) => {
        const element = document.querySelector(sel)
        if (!element) throw new Error(`Element not found: ${sel}`)
        
        if (styles) {
          // Clone element and inline styles
          const clone = element.cloneNode(true) as HTMLElement
          const allElements = clone.querySelectorAll('*')
          allElements.forEach((el) => {
            const computed = window.getComputedStyle(el as HTMLElement)
            ;(el as HTMLElement).setAttribute('style', computed.cssText)
          })
          return clone.outerHTML
        }
        
        return element.outerHTML
      }, { sel: selector, styles: includeStyles })
    }
    
    return await page.content()
  }

  private async exportJSON(page: Page, selector?: string): Promise<string> {
    const data = await page.evaluate((sel) => {
      if (sel) {
        const element = document.querySelector(sel)
        if (!element) throw new Error(`Element not found: ${sel}`)
        
        // Special handling for tables
        if (element.tagName === 'TABLE') {
          const headers: string[] = []
          const rows: any[] = []
          
          // Get headers
          element.querySelectorAll('thead th').forEach((th) => {
            headers.push(th.textContent?.trim() || '')
          })
          
          // Get rows
          element.querySelectorAll('tbody tr').forEach((tr) => {
            const row: any = {}
            tr.querySelectorAll('td').forEach((td, i) => {
              const key = headers[i] || `col${i}`
              row[key] = td.textContent?.trim() || ''
            })
            rows.push(row)
          })
          
          return rows
        }
        
        // Try to extract data attributes
        const dataAttrs: any = {}
        Array.from(element.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-')) {
            const key = attr.name.replace('data-', '')
            try {
              dataAttrs[key] = JSON.parse(attr.value)
            } catch {
              dataAttrs[key] = attr.value
            }
          }
        })
        
        return {
          text: element.textContent?.trim(),
          attributes: dataAttrs,
          html: element.innerHTML,
        }
      }
      
      // Export all data elements
      const allData: any[] = []
      document.querySelectorAll('[data-export], [data-json], table').forEach((el) => {
        if (el.tagName === 'TABLE') {
          // Handle tables as above
          const headers: string[] = []
          const rows: any[] = []
          
          el.querySelectorAll('thead th').forEach((th) => {
            headers.push(th.textContent?.trim() || '')
          })
          
          el.querySelectorAll('tbody tr').forEach((tr) => {
            const row: any = {}
            tr.querySelectorAll('td').forEach((td, i) => {
              const key = headers[i] || `col${i}`
              row[key] = td.textContent?.trim() || ''
            })
            rows.push(row)
          })
          
          allData.push({ type: 'table', data: rows })
        } else {
          // Handle data elements
          const data = el.getAttribute('data-json') || el.getAttribute('data-export')
          if (data) {
            try {
              allData.push(JSON.parse(data))
            } catch {
              allData.push(data)
            }
          }
        }
      })
      
      return allData
    }, selector)
    
    return JSON.stringify(data, null, 2)
  }

  private async exportCSV(page: Page, selector?: string): Promise<string> {
    const tableSelector = selector || 'table'
    
    return await page.evaluate((sel) => {
      const table = document.querySelector(sel)
      if (!table || table.tagName !== 'TABLE') {
        throw new Error('No table found with selector: ' + sel)
      }
      
      const rows: string[] = []
      
      // Get headers
      const headers: string[] = []
      table.querySelectorAll('thead th').forEach((th) => {
        headers.push(`"${th.textContent?.trim().replace(/"/g, '""') || ''}"`)
      })
      if (headers.length > 0) {
        rows.push(headers.join(','))
      }
      
      // Get data rows
      table.querySelectorAll('tbody tr').forEach((tr) => {
        const cells: string[] = []
        tr.querySelectorAll('td').forEach((td) => {
          cells.push(`"${td.textContent?.trim().replace(/"/g, '""') || ''}"`)
        })
        rows.push(cells.join(','))
      })
      
      return rows.join('\n')
    }, tableSelector)
  }

  private async exportMarkdown(page: Page, selector?: string): Promise<string> {
    return await page.evaluate((sel) => {
      const element = sel ? document.querySelector(sel) : document.body
      if (!element) throw new Error(`Element not found: ${sel}`)
      
      // Simple HTML to Markdown conversion
      function htmlToMarkdown(el: Element): string {
        let md = ''
        
        for (const node of Array.from(el.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            md += node.textContent
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const elem = node as Element
            const tag = elem.tagName.toLowerCase()
            
            switch (tag) {
              case 'h1':
                md += `# ${elem.textContent?.trim()}\n\n`
                break
              case 'h2':
                md += `## ${elem.textContent?.trim()}\n\n`
                break
              case 'h3':
                md += `### ${elem.textContent?.trim()}\n\n`
                break
              case 'h4':
                md += `#### ${elem.textContent?.trim()}\n\n`
                break
              case 'h5':
                md += `##### ${elem.textContent?.trim()}\n\n`
                break
              case 'h6':
                md += `###### ${elem.textContent?.trim()}\n\n`
                break
              case 'p':
                md += `${elem.textContent?.trim()}\n\n`
                break
              case 'a':
                md += `[${elem.textContent?.trim()}](${elem.getAttribute('href')})`
                break
              case 'img':
                md += `![${elem.getAttribute('alt') || ''}](${elem.getAttribute('src')})`
                break
              case 'strong':
              case 'b':
                md += `**${elem.textContent?.trim()}**`
                break
              case 'em':
              case 'i':
                md += `*${elem.textContent?.trim()}*`
                break
              case 'code':
                md += `\`${elem.textContent?.trim()}\``
                break
              case 'pre':
                md += `\`\`\`\n${elem.textContent?.trim()}\n\`\`\`\n\n`
                break
              case 'ul':
              case 'ol':
                const items = Array.from(elem.querySelectorAll('li'))
                items.forEach((li, i) => {
                  const prefix = tag === 'ol' ? `${i + 1}. ` : '- '
                  md += `${prefix}${li.textContent?.trim()}\n`
                })
                md += '\n'
                break
              case 'blockquote':
                md += `> ${elem.textContent?.trim()}\n\n`
                break
              case 'hr':
                md += '---\n\n'
                break
              case 'br':
                md += '\n'
                break
              case 'table':
                // Convert table to markdown
                const headers = Array.from(elem.querySelectorAll('thead th'))
                if (headers.length > 0) {
                  md += '| ' + headers.map(th => th.textContent?.trim()).join(' | ') + ' |\n'
                  md += '| ' + headers.map(() => '---').join(' | ') + ' |\n'
                }
                elem.querySelectorAll('tbody tr').forEach((tr) => {
                  const cells = Array.from(tr.querySelectorAll('td'))
                  md += '| ' + cells.map(td => td.textContent?.trim()).join(' | ') + ' |\n'
                })
                md += '\n'
                break
              default:
                md += htmlToMarkdown(elem)
            }
          }
        }
        
        return md
      }
      
      return htmlToMarkdown(element)
    }, selector)
  }

  private async exportText(page: Page, selector?: string): Promise<string> {
    if (selector) {
      return await page.evaluate((sel) => {
        const element = document.querySelector(sel)
        if (!element) throw new Error(`Element not found: ${sel}`)
        return element.textContent?.trim() || ''
      }, selector)
    }
    
    return await page.evaluate(() => document.body.textContent?.trim() || '')
  }

  private async exportResources(page: Page, outputDir: string): Promise<void> {
    const { flags } = await this.parse(Export)
    await fs.mkdir(outputDir, { recursive: true })
    
    // Get all resource URLs
    const resources = await page.evaluate(() => {
      const urls = new Set<string>()
      
      // Images
      document.querySelectorAll('img').forEach((img) => {
        if (img.src) urls.add(img.src)
      })
      
      // Stylesheets
      document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        if ((link as HTMLLinkElement).href) urls.add((link as HTMLLinkElement).href)
      })
      
      // Scripts
      document.querySelectorAll('script[src]').forEach((script) => {
        if ((script as HTMLScriptElement).src) urls.add((script as HTMLScriptElement).src)
      })
      
      return Array.from(urls)
    })
    
    this.log(`📦 Exporting ${resources.length} resources...`)
    
    // Download each resource
    for (const url of resources) {
      try {
        const response = await page.request.get(url)
        if (response.ok()) {
          const urlObj = new URL(url)
          const filename = path.basename(urlObj.pathname) || 'index.html'
          const filepath = path.join(outputDir, filename)
          
          const buffer = await response.body()
          await fs.writeFile(filepath, buffer)
          
          if (flags.verbose) {
            this.logVerbose(`Downloaded: ${filename}`)
          }
        }
      } catch (error) {
        this.warn(`Failed to download: ${url}`)
      }
    }
    
    this.log(`✅ Resources exported to: ${outputDir}`)
  }
}