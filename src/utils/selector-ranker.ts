import { Page } from 'playwright'

export interface RankedSelector {
  selector: string
  count: number
  samples: string[]
  confidence: number
}

export class SelectorRanker {
  constructor(private page: Page) {}

  async rankSelectors(
    candidates: string[],
    sampleSize: number = 2
  ): Promise<RankedSelector[]> {
    const results = await Promise.all(
      candidates.map(async (selector) => {
        try {
          const elements = await this.page.$$(selector)
          const count = elements.length
          
          if (count === 0) {
            return { selector, count: 0, samples: [], confidence: 0 }
          }

          // Collect sample texts
          const samples: string[] = []
          for (let i = 0; i < Math.min(sampleSize, elements.length); i++) {
            const text = await elements[i].innerText().catch(() => '')
            if (text && text.trim()) {
              samples.push(text.trim().substring(0, 100))
            }
          }

          // Calculate confidence based on various factors
          const confidence = this.calculateConfidence(selector, count, samples)

          return { selector, count, samples, confidence }
        } catch (error) {
          return { selector, count: 0, samples: [], confidence: 0 }
        }
      })
    )

    // Filter out failed selectors and sort by confidence, then count
    return results
      .filter(r => r.count > 0)
      .sort((a, b) => {
        if (Math.abs(a.confidence - b.confidence) > 0.1) {
          return b.confidence - a.confidence
        }
        return b.count - a.count
      })
  }

  private calculateConfidence(selector: string, count: number, samples: string[]): number {
    let confidence = 0.5

    // Higher count generally means better pattern
    if (count >= 10) confidence += 0.2
    else if (count >= 5) confidence += 0.1

    // Consistent sample lengths suggest uniform data
    if (samples.length >= 2) {
      const lengths = samples.map(s => s.length)
      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
      const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length
      
      if (variance < avgLength * 0.3) {
        confidence += 0.1
      }
    }

    // Prefer specific selectors over generic ones
    if (selector.includes('.') || selector.includes('[')) {
      confidence += 0.1
    }
    
    // Penalize overly generic selectors
    if (selector === 'div' || selector === 'span') {
      confidence -= 0.3
    }

    // Prefer selectors that look like data containers
    if (selector.includes('item') || selector.includes('card') || 
        selector.includes('row') || selector.includes('result')) {
      confidence += 0.1
    }

    return Math.max(0, Math.min(1, confidence))
  }

  async testSelector(selector: string): Promise<{
    valid: boolean
    count: number
    sample?: string
    error?: string
  }> {
    try {
      const elements = await this.page.$$(selector)
      const count = elements.length
      
      if (count === 0) {
        return { valid: false, count: 0, error: 'No elements found' }
      }

      const sample = await elements[0].innerText().catch(() => '')
      
      return {
        valid: true,
        count,
        sample: sample?.trim().substring(0, 100)
      }
    } catch (error) {
      return {
        valid: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Invalid selector'
      }
    }
  }

  async findAlternatives(failedSelector: string, limit: number = 5): Promise<string[]> {
    // Extract key parts from the failed selector
    const parts = this.extractSelectorParts(failedSelector)
    
    return await this.page.evaluate(({ parts, limit }) => {
      const alternatives = new Set<string>()
      
      // Try each part individually
      parts.forEach(part => {
        if (part.startsWith('.')) {
          // Class selector
          const elements = document.querySelectorAll(part)
          if (elements.length > 0) {
            alternatives.add(part)
          }
        } else if (part.startsWith('#')) {
          // ID selector
          const element = document.querySelector(part)
          if (element) {
            alternatives.add(part)
          }
        } else if (part.includes('=')) {
          // Attribute selector
          try {
            const elements = document.querySelectorAll(`[${part}]`)
            if (elements.length > 0) {
              alternatives.add(`[${part}]`)
            }
          } catch {}
        }
      })

      // Look for similar classes
      if (failedSelector.includes('.')) {
        const className = failedSelector.match(/\.([a-zA-Z0-9_-]+)/)?.[1]
        if (className) {
          document.querySelectorAll('[class*="' + className.substring(0, 3) + '"]').forEach(el => {
            Array.from(el.classList).forEach(cls => {
              if (cls.includes(className.substring(0, 3))) {
                alternatives.add(`.${cls}`)
              }
            })
          })
        }
      }

      return Array.from(alternatives).slice(0, limit)
    }, { parts, limit })
  }

  private extractSelectorParts(selector: string): string[] {
    const parts: string[] = []
    
    // Extract classes
    const classes = selector.match(/\.[a-zA-Z0-9_-]+/g) || []
    parts.push(...classes)
    
    // Extract IDs
    const ids = selector.match(/#[a-zA-Z0-9_-]+/g) || []
    parts.push(...ids)
    
    // Extract attributes
    const attrs = selector.match(/\[([^\]]+)\]/g) || []
    attrs.forEach(attr => {
      parts.push(attr.slice(1, -1))
    })
    
    // Extract tag names
    const tagMatch = selector.match(/^([a-zA-Z]+)/)
    if (tagMatch) {
      parts.push(tagMatch[1])
    }
    
    return parts
  }
}