import { Page } from 'playwright'

export interface SearchResultPattern {
  selector: string
  type: 'news' | 'bio' | 'product' | 'video' | 'generic'
  confidence: number
  sampleTexts: string[]
  characteristics: {
    hasDate?: boolean
    hasAuthor?: boolean
    hasSource?: boolean
    hasPrice?: boolean
    hasDuration?: boolean
    isTopResult?: boolean
    containerClass?: string
  }
}

export class SearchResultAnalyzer {
  constructor(private page: Page) {}

  async analyzeSearchResults(): Promise<{
    patterns: SearchResultPattern[]
    recommendations: string[]
  }> {
    return await this.page.evaluate(() => {
      const patterns: SearchResultPattern[] = []
      
      // Common search result containers
      const containerSelectors = [
        '[data-testid*="result"]',
        '[class*="search-result"]',
        '[class*="result-item"]',
        '[class*="SearchResult"]',
        '.g', // Google specific
        'article',
        '[role="article"]',
        'li[class*="result"]'
      ]
      
      // Analyze each container type
      containerSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector)
        if (elements.length < 2) return // Need multiple to be a pattern
        
        // Sample first 3 elements
        const samples = Array.from(elements).slice(0, 3)
        const sampleTexts = samples.map(el => (el as HTMLElement).innerText.substring(0, 200))
        
        // Analyze characteristics inline (since we're in evaluate context)
        const characteristics: SearchResultPattern['characteristics'] = {}
        
        // Check for common patterns
        const datePatterns = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}|\d{4}|ago|yesterday|today)\b/i
        const sourcePatterns = /\b(CNN|BBC|Reuters|Times|Post|Journal|News|Blog)\b/i
        const pricePatterns = /\$\d+|\d+\.\d{2}|USD|EUR|£/
        const durationPatterns = /\d+:\d+|\d+ min|\d+ hour/i
        
        samples.forEach(el => {
          const text = (el as HTMLElement).innerText
          
          if (datePatterns.test(text)) characteristics.hasDate = true
          if (sourcePatterns.test(text)) characteristics.hasSource = true
          if (pricePatterns.test(text)) characteristics.hasPrice = true
          if (durationPatterns.test(text)) characteristics.hasDuration = true
          
          // Check position - top results often have special styling
          const rect = el.getBoundingClientRect()
          if (rect.top < 300) characteristics.isTopResult = true
          
          // Store container class for reference
          if (!characteristics.containerClass && el.className) {
            characteristics.containerClass = el.className.split(' ')[0]
          }
        })
        
        // Determine type inline
        const combinedText = sampleTexts.join(' ').toLowerCase()
        let type: SearchResultPattern['type'] = 'generic'
        
        if (characteristics.hasDate && characteristics.hasSource) {
          type = 'news'
        } else if (characteristics.hasPrice) {
          type = 'product'
        } else if (characteristics.hasDuration) {
          type = 'video'
        } else if (characteristics.isTopResult && 
            (combinedText.includes('biography') || 
             combinedText.includes('profile') || 
             combinedText.includes('official') ||
             combinedText.includes('wikipedia'))) {
          type = 'bio'
        }
        
        // Calculate confidence inline
        let confidence = 0.5
        if (elements.length >= 10) confidence += 0.2
        else if (elements.length >= 5) confidence += 0.1
        
        if (type === 'news' && characteristics.hasDate && characteristics.hasSource) {
          confidence += 0.2
        } else if (type === 'product' && characteristics.hasPrice) {
          confidence += 0.2
        } else if (type === 'video' && characteristics.hasDuration) {
          confidence += 0.2
        }
        
        if (characteristics.isTopResult && type !== 'news') {
          confidence -= 0.2
        }
        
        confidence = Math.max(0.1, Math.min(1, confidence))
        
        patterns.push({
          selector,
          type,
          confidence,
          sampleTexts,
          characteristics
        })
      })
      
      // Sort by confidence
      patterns.sort((a, b) => b.confidence - a.confidence)
      
      // Generate recommendations inline
      const recommendations: string[] = []
      
      const newsPatterns = patterns.filter(p => p.type === 'news' && p.confidence > 0.5)
      const genericPatterns = patterns.filter(p => p.type === 'generic' && p.confidence > 0.5)
      
      if (newsPatterns.length > 0) {
        recommendations.push(
          `For news articles, use selector: ${newsPatterns[0].selector}`,
          'These elements contain dates and news sources'
        )
      }
      
      if (genericPatterns.length > 0 && newsPatterns.length === 0) {
        recommendations.push(
          `Main search results found at: ${genericPatterns[0].selector}`,
          'Consider filtering by text content to find specific result types'
        )
      }
      
      // Warn about bio results
      const bioPatterns = patterns.filter(p => p.type === 'bio')
      if (bioPatterns.length > 0) {
        recommendations.push(
          'Note: Top results appear to be biography/profile links',
          'For news articles, look further down the page'
        )
      }
      
      return { patterns, recommendations }
    })
  }

  private analyzeElements(elements: Element[]): SearchResultPattern['characteristics'] {
    const characteristics: SearchResultPattern['characteristics'] = {}
    
    // Check for common patterns
    const datePatterns = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}|\d{4}|ago|yesterday|today)\b/i
    const sourcePatterns = /\b(CNN|BBC|Reuters|Times|Post|Journal|News|Blog)\b/i
    const pricePatterns = /\$\d+|\d+\.\d{2}|USD|EUR|£/
    const durationPatterns = /\d+:\d+|\d+ min|\d+ hour/i
    
    elements.forEach(el => {
      const text = (el as HTMLElement).innerText
      
      if (datePatterns.test(text)) characteristics.hasDate = true
      if (sourcePatterns.test(text)) characteristics.hasSource = true
      if (pricePatterns.test(text)) characteristics.hasPrice = true
      if (durationPatterns.test(text)) characteristics.hasDuration = true
      
      // Check position - top results often have special styling
      const rect = el.getBoundingClientRect()
      if (rect.top < 300) characteristics.isTopResult = true
      
      // Store container class for reference
      if (!characteristics.containerClass && el.className) {
        characteristics.containerClass = el.className.split(' ')[0]
      }
    })
    
    return characteristics
  }

  private determineResultType(
    characteristics: SearchResultPattern['characteristics'],
    sampleTexts: string[]
  ): SearchResultPattern['type'] {
    const combinedText = sampleTexts.join(' ').toLowerCase()
    
    // News articles typically have dates and sources
    if (characteristics.hasDate && characteristics.hasSource) {
      return 'news'
    }
    
    // Product results have prices
    if (characteristics.hasPrice) {
      return 'product'
    }
    
    // Video results have durations
    if (characteristics.hasDuration) {
      return 'video'
    }
    
    // Bio/profile results often appear at top and have specific keywords
    if (characteristics.isTopResult && 
        (combinedText.includes('biography') || 
         combinedText.includes('profile') || 
         combinedText.includes('official') ||
         combinedText.includes('wikipedia'))) {
      return 'bio'
    }
    
    return 'generic'
  }

  private calculateConfidence(
    count: number,
    characteristics: SearchResultPattern['characteristics'],
    type: SearchResultPattern['type']
  ): number {
    let confidence = 0.5
    
    // More elements = higher confidence
    if (count >= 10) confidence += 0.2
    else if (count >= 5) confidence += 0.1
    
    // Type-specific confidence boosts
    if (type === 'news' && characteristics.hasDate && characteristics.hasSource) {
      confidence += 0.2
    } else if (type === 'product' && characteristics.hasPrice) {
      confidence += 0.2
    } else if (type === 'video' && characteristics.hasDuration) {
      confidence += 0.2
    }
    
    // Lower confidence for top results (often not what user wants)
    if (characteristics.isTopResult && type !== 'news') {
      confidence -= 0.2
    }
    
    return Math.max(0.1, Math.min(1, confidence))
  }

  private generateRecommendations(patterns: SearchResultPattern[]): string[] {
    const recommendations: string[] = []
    
    const newsPatterns = patterns.filter(p => p.type === 'news' && p.confidence > 0.5)
    const genericPatterns = patterns.filter(p => p.type === 'generic' && p.confidence > 0.5)
    
    if (newsPatterns.length > 0) {
      recommendations.push(
        `For news articles, use selector: ${newsPatterns[0].selector}`,
        'These elements contain dates and news sources'
      )
    }
    
    if (genericPatterns.length > 0 && newsPatterns.length === 0) {
      recommendations.push(
        `Main search results found at: ${genericPatterns[0].selector}`,
        'Consider filtering by text content to find specific result types'
      )
    }
    
    // Warn about bio results
    const bioPatterns = patterns.filter(p => p.type === 'bio')
    if (bioPatterns.length > 0) {
      recommendations.push(
        'Note: Top results appear to be biography/profile links',
        'For news articles, look further down the page'
      )
    }
    
    return recommendations
  }
}