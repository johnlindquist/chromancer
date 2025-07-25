import { Page } from 'playwright';
import { DOMDigestCollector, DOMDigest } from './dom-digest.js';
import { SelectorRanker } from './selector-ranker.js';
import { SearchResultAnalyzer } from './search-result-analyzer.js';

export interface DOMInspectionResult {
  selectors: {
    common: string[];
    withText: { selector: string; text: string }[];
    dataAttributes: string[];
  };
  structure: {
    headings: { level: string; text: string; selector: string }[];
    links: { text: string; href: string; selector: string }[];
    buttons: { text: string; selector: string }[];
    inputs: { type: string; name?: string; placeholder?: string; selector: string; visible?: boolean }[];
  };
  visibility: {
    hiddenElements: { selector: string; reason: string }[];
    revealTriggers: { triggerSelector: string; targetSelector: string; action: string }[];
  };
  suggestions: string[];
  digest?: DOMDigest;
}

export class DOMInspector {
  private page: Page;
  private digestCollector: DOMDigestCollector;
  private selectorRanker: SelectorRanker;

  constructor(page: Page) {
    this.page = page;
    this.digestCollector = new DOMDigestCollector(page);
    this.selectorRanker = new SelectorRanker(page);
  }

  async inspectForDataExtraction(targetDescription: string): Promise<DOMInspectionResult> {
    const inspection = await this.page.evaluate(() => {
      // Helper to create unique selector for element
      const getSelector = (el: Element): string => {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':'));
          if (classes.length > 0) return `.${classes.join('.')}`;
        }
        return el.tagName.toLowerCase();
      };

      // Helper to check if element is visible
      const isElementVisible = (el: Element): boolean => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               el.clientHeight > 0;
      };

      // Find common patterns
      const findPatterns = () => {
        const patterns: Record<string, Element[]> = {};
        
        // Look for common list patterns
        const lists = Array.from(document.querySelectorAll('ul, ol, [role="list"]'));
        lists.forEach(list => {
          const items = Array.from(list.querySelectorAll('li, [role="listitem"]'));
          if (items.length > 2) {
            const selector = getSelector(list);
            patterns[`${selector} > li`] = items;
          }
        });

        // Look for repeated structures
        const allElements = Array.from(document.querySelectorAll('*'));
        const classGroups: Record<string, Element[]> = {};
        
        allElements.forEach(el => {
          if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/);
            classes.forEach(cls => {
              if (cls && !cls.includes(':')) {
                if (!classGroups[cls]) classGroups[cls] = [];
                classGroups[cls].push(el);
              }
            });
          }
        });

        // Find classes with multiple elements (likely repeated items)
        Object.entries(classGroups).forEach(([cls, elements]) => {
          if (elements.length > 2) {
            patterns[`.${cls}`] = elements;
          }
        });

        return patterns;
      };

      const patterns = findPatterns();
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Get common selectors
      const commonSelectors = Object.keys(patterns)
        .filter(sel => patterns[sel].length > 2)
        .sort((a, b) => patterns[b].length - patterns[a].length)
        .slice(0, 10);

      // Find elements with specific text
      const withText: { selector: string; text: string }[] = [];
      
      // Search for common container elements
      ['div', 'article', 'section', 'li', 'a', 'h1', 'h2', 'h3'].forEach(tag => {
        const elements = Array.from(document.querySelectorAll(tag));
        elements.slice(0, 5).forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 10 && text.length < 200) {
            withText.push({
              selector: getSelector(el),
              text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
            });
          }
        });
      });

      // Find data attributes
      const dataAttributes = Array.from(new Set(
        allElements
          .map((el: Element) => Array.from(el.attributes))
          .flat()
          .filter((attr: Attr) => attr.name.startsWith('data-') || attr.name.startsWith('aria-'))
          .map((attr: Attr) => attr.name)
      )).slice(0, 20);

      // Analyze structure
      const structure = {
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: h.tagName.toLowerCase(),
          text: h.textContent?.trim() || '',
          selector: getSelector(h)
        })).slice(0, 10),
        
        links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.textContent?.trim() || '',
          href: (a as HTMLAnchorElement).href,
          selector: getSelector(a)
        })).filter(l => l.text).slice(0, 10),
        
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(b => ({
          text: b.textContent?.trim() || (b as HTMLInputElement).value || '',
          selector: getSelector(b)
        })).filter(b => b.text).slice(0, 10),
        
        inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(i => ({
          type: (i as HTMLInputElement).type || i.tagName.toLowerCase(),
          name: (i as HTMLInputElement).name || undefined,
          placeholder: (i as HTMLInputElement).placeholder || undefined,
          selector: getSelector(i),
          visible: isElementVisible(i)
        })).slice(0, 10)
      };

      // Analyze visibility patterns
      const visibility = {
        hiddenElements: [] as { selector: string; reason: string }[],
        revealTriggers: [] as { triggerSelector: string; targetSelector: string; action: string }[]
      };

      // Check for hidden inputs and their potential triggers
      structure.inputs.forEach(input => {
        if (!input.visible && input.selector) {
          visibility.hiddenElements.push({
            selector: input.selector,
            reason: 'Input element exists but is not visible'
          });

          // Look for nearby buttons/icons that might reveal it
          const nearbyButtons = Array.from(document.querySelectorAll('button, [role="button"], svg, i'))
            .filter(btn => {
              const btnText = btn.textContent?.toLowerCase() || '';
              const btnClass = btn.className?.toString().toLowerCase() || '';
              return btnText.includes('search') || btnClass.includes('search') || 
                     btnClass.includes('magnif') || btnClass.includes('glass');
            });

          if (nearbyButtons.length > 0) {
            visibility.revealTriggers.push({
              triggerSelector: getSelector(nearbyButtons[0]),
              targetSelector: input.selector,
              action: 'click to reveal hidden input'
            });
          }
        }
      });

      return {
        commonSelectors,
        withText,
        dataAttributes,
        structure,
        visibility
      };
    });

    // Generate suggestions based on target
    const suggestions = this.generateSuggestions(inspection, targetDescription);

    return {
      selectors: {
        common: inspection.commonSelectors,
        withText: inspection.withText,
        dataAttributes: inspection.dataAttributes as string[]
      },
      structure: inspection.structure,
      visibility: inspection.visibility,
      suggestions
    };
  }

  private generateSuggestions(inspection: any, target: string): string[] {
    const suggestions: string[] = [];
    const lowerTarget = target.toLowerCase();

    // Suggest based on target keywords
    if (lowerTarget.includes('search') || lowerTarget.includes('result')) {
      suggestions.push(
        "Try selectors like: [data-testid*='result'], .search-result, #search .result-item",
        "Look for repeated structures with 3+ items using: " + inspection.commonSelectors.slice(0, 3).join(', ')
      );
    }

    if (lowerTarget.includes('title') || lowerTarget.includes('heading')) {
      if (inspection.structure.headings.length > 0) {
        suggestions.push(
          `Found ${inspection.structure.headings.length} headings. Try: ${inspection.structure.headings[0].selector}`,
          "For all headings use: h1, h2, h3, h4"
        );
      }
    }

    if (lowerTarget.includes('link')) {
      if (inspection.structure.links.length > 0) {
        suggestions.push(
          `Found ${inspection.structure.links.length} links. Common pattern: a[href]`,
          `First link selector: ${inspection.structure.links[0].selector}`
        );
      }
    }

    // General suggestions
    if (inspection.commonSelectors.length > 0) {
      suggestions.push(
        `Most repeated element pattern: ${inspection.commonSelectors[0]} (${inspection.commonSelectors.length} instances)`
      );
    }

    return suggestions;
  }

  async findWorkingSelectors(possibleSelectors: string[]): Promise<{ selector: string; count: number }[]> {
    const results: { selector: string; count: number }[] = [];

    for (const selector of possibleSelectors) {
      try {
        const count = await this.page.evaluate((sel) => {
          try {
            return document.querySelectorAll(sel).length;
          } catch {
            return 0;
          }
        }, selector);

        if (count > 0) {
          results.push({ selector, count });
        }
      } catch {
        // Ignore invalid selectors
      }
    }

    return results.sort((a, b) => b.count - a.count);
  }

  async inspectWithDigest(targetDescription: string): Promise<DOMInspectionResult> {
    // Collect digest first
    const digest = await this.digestCollector.collect();
    
    // Run normal inspection
    const result = await this.inspectForDataExtraction(targetDescription);
    
    // Add digest to result
    result.digest = digest;
    
    // Check if this is a search-related query
    const searchKeywords = ['search', 'results', 'news', 'articles', 'headlines'];
    const isSearchQuery = searchKeywords.some(keyword => 
      targetDescription.toLowerCase().includes(keyword)
    );
    
    if (isSearchQuery) {
      // Run search-specific analysis
      const analyzer = new SearchResultAnalyzer(this.page);
      const searchAnalysis = await analyzer.analyzeSearchResults();
      
      // Prioritize news patterns for news queries
      if (targetDescription.toLowerCase().includes('news') || 
          targetDescription.toLowerCase().includes('article')) {
        const newsPatterns = searchAnalysis.patterns
          .filter(p => p.type === 'news')
          .map(p => p.selector);
        
        if (newsPatterns.length > 0) {
          // Add news patterns to the front
          result.selectors.common = [...newsPatterns, ...result.selectors.common];
          result.suggestions.unshift(...searchAnalysis.recommendations);
        }
      }
    }
    
    // Rank the common selectors
    if (result.selectors.common.length > 0) {
      const ranked = await this.selectorRanker.rankSelectors(result.selectors.common);
      result.selectors.common = ranked.map(r => r.selector);
    }
    
    return result;
  }

  async suggestSelectorsForExtraction(description: string): Promise<string[]> {
    const keywords = description.toLowerCase().split(' ');
    const suggestions: string[] = [];

    // Common patterns based on keywords
    const patterns: Record<string, string[]> = {
      'search': ['[class*="search-result"]', '[class*="result"]', '[data-testid*="result"]', '.g', 'article'],
      'title': ['h1', 'h2', 'h3', '[class*="title"]', '[class*="heading"]', '.title', '.headline'],
      'link': ['a[href]', '[class*="link"]', 'a.result', 'h3 a'],
      'price': ['[class*="price"]', '[data-price]', '.price', 'span[class*="cost"]'],
      'description': ['[class*="description"]', '[class*="summary"]', '.description', 'p'],
      'item': ['[class*="item"]', '[class*="card"]', '.item', 'article', 'li'],
      'list': ['ul li', 'ol li', '[role="list"] [role="listitem"]', '.list-item']
    };

    // Add patterns based on keywords
    keywords.forEach(keyword => {
      if (patterns[keyword]) {
        suggestions.push(...patterns[keyword]);
      }
    });

    // Add generic patterns if no specific ones found
    if (suggestions.length === 0) {
      suggestions.push(
        'article', 'div[class*="item"]', 'li', '[data-testid]',
        '.card', '.result', 'section > div'
      );
    }

    // Test and return working selectors
    const working = await this.findWorkingSelectors([...new Set(suggestions)]);
    return working.map(w => w.selector);
  }
}