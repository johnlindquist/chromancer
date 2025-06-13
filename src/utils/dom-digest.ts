import { Page } from 'playwright'

export interface DOMDigest {
  url: string
  title: string
  patterns: Array<{ selector: string; count: number }>
  texts: string[]
  attrs: string[]
  timestamp: number
}

export class DOMDigestCollector {
  private static readonly REJECTED_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG', 'HEAD']
  private static readonly MAX_PATTERNS = 30
  private static readonly MAX_TEXTS = 30
  private static readonly MAX_ATTRS = 30
  private static readonly MAX_TEXT_LENGTH = 100
  private static readonly MIN_PATTERN_COUNT = 3

  constructor(private page: Page) {}

  async collect(): Promise<DOMDigest> {
    return await this.page.evaluate(() => {
      const digestKey = '__chromancerDigest'
      const cached = (window as any)[digestKey]
      if (cached && cached.url === window.location.href) {
        return cached
      }

      const rejected = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IMG', 'HEAD']
      const elements = Array.from(document.querySelectorAll('*'))
        .filter(el => !rejected.includes(el.tagName))

      // Collect patterns
      const classPatterns = new Map<string, number>()
      const rolePatterns = new Map<string, number>()
      const tagPatterns = new Map<string, number>()

      elements.forEach(el => {
        // Count class patterns
        if (el.className && typeof el.className === 'string') {
          el.className.split(/\s+/).filter(c => c).forEach(cls => {
            const selector = `.${cls}`
            classPatterns.set(selector, (classPatterns.get(selector) || 0) + 1)
          })
        }

        // Count role patterns
        const role = el.getAttribute('role')
        if (role) {
          const selector = `[role="${role}"]`
          rolePatterns.set(selector, (rolePatterns.get(selector) || 0) + 1)
        }

        // Count tag patterns for meaningful tags
        const meaningfulTags = ['article', 'section', 'aside', 'nav', 'header', 'footer', 'main']
        if (meaningfulTags.includes(el.tagName.toLowerCase())) {
          tagPatterns.set(el.tagName.toLowerCase(), (tagPatterns.get(el.tagName.toLowerCase()) || 0) + 1)
        }
      })

      // Combine and sort patterns
      const allPatterns = [
        ...Array.from(classPatterns.entries()),
        ...Array.from(rolePatterns.entries()),
        ...Array.from(tagPatterns.entries())
      ]
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([selector, count]) => ({ selector, count }))

      // Collect meaningful text nodes
      const texts: string[] = []
      const textNodes = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement
            if (!parent || rejected.includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT
            }
            const text = node.textContent?.trim() || ''
            if (text.length > 10 && text.length < 100) {
              return NodeFilter.FILTER_ACCEPT
            }
            return NodeFilter.FILTER_REJECT
          }
        }
      )

      let textNode
      while ((textNode = textNodes.nextNode()) && texts.length < 30) {
        const text = textNode.textContent?.trim() || ''
        if (text && !texts.includes(text)) {
          texts.push(text)
        }
      }

      // Collect data attributes
      const attrs = new Set<string>()
      elements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) {
            attrs.add(attr.name)
          }
        })
      })

      const digest: DOMDigest = {
        url: window.location.href,
        title: document.title,
        patterns: allPatterns,
        texts: texts.slice(0, 30),
        attrs: Array.from(attrs).slice(0, 30),
        timestamp: Date.now()
      }

      // Cache for reuse
      ;(window as any)[digestKey] = digest
      return digest
    })
  }

  async getDigestSize(digest: DOMDigest): Promise<number> {
    return JSON.stringify(digest).length
  }

  formatForClaude(digest: DOMDigest): string {
    const lines = [
      `URL: ${digest.url}`,
      `Title: ${digest.title}`,
      '',
      'Top Patterns:',
      ...digest.patterns.slice(0, 10).map(p => `  ${p.selector} (${p.count} elements)`),
      '',
      'Sample Text Content:',
      ...digest.texts.slice(0, 10).map(t => `  "${t}"`),
      '',
      'Available Attributes:',
      `  ${digest.attrs.slice(0, 20).join(', ')}`
    ]
    
    return lines.join('\n')
  }
}