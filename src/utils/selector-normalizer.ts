/**
 * Normalizes CSS selectors to ensure they work correctly when passed through YAML
 */
export function normalizeSelector(selector: string | any): string | any {
  // If not a string, return as-is (could be an object with selector property)
  if (typeof selector !== 'string') {
    return selector;
  }

  // Trim whitespace
  selector = selector.trim();

  // Handle attribute selectors with quotes
  // Convert variations to a consistent format
  selector = selector
    // First, handle attribute selectors with escaped quotes (e.g., type=\'search\')
    .replace(/\[([^=\]]+)=\\(['"])([^'"]+)\\(['"])\]/g, (match: string, attr: string, q1: string, value: string, q2: string) => {
      return `[${attr}="${value}"]`;
    })
    // Then handle attribute selectors with normal quotes
    .replace(/\[([^=\]]+)=(['"]?)([^'"\]]+)(['"]?)\]/g, (match: string, attr: string, q1: string, value: string, q2: string) => {
      // Only process if quotes match or no quotes
      if ((q1 === q2) || (!q1 && !q2)) {
        return `[${attr}="${value}"]`;
      }
      return match;
    });

  return selector;
}

/**
 * Validates a CSS selector to ensure it's properly formatted
 */
export function isValidSelector(selector: string): boolean {
  if (!selector || typeof selector !== 'string') {
    return false;
  }

  try {
    // Basic validation patterns
    const invalidPatterns = [
      /^\s*$/, // Empty or whitespace only
      /[\n\r\t]/, // Contains newlines or tabs
      /['"]\s*['"]/  // Mismatched quotes
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(selector)) {
        return false;
      }
    }

    // Check for balanced brackets and quotes
    let brackets = 0;
    let singleQuotes = 0;
    let doubleQuotes = 0;
    let inEscape = false;

    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      const prevChar = i > 0 ? selector[i - 1] : '';

      if (inEscape) {
        inEscape = false;
        continue;
      }

      if (char === '\\') {
        inEscape = true;
        continue;
      }

      switch (char) {
        case '[':
          if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) brackets++;
          break;
        case ']':
          if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) brackets--;
          break;
        case "'":
          if (doubleQuotes % 2 === 0 && prevChar !== '\\') singleQuotes++;
          break;
        case '"':
          if (singleQuotes % 2 === 0 && prevChar !== '\\') doubleQuotes++;
          break;
      }
    }

    return brackets === 0 && singleQuotes % 2 === 0 && doubleQuotes % 2 === 0;
  } catch {
    return false;
  }
}

/**
 * Formats a selector for display in error messages
 */
export function formatSelectorForError(selector: string | any): string {
  if (typeof selector !== 'string') {
    return JSON.stringify(selector);
  }
  
  // Truncate long selectors
  if (selector.length > 100) {
    return selector.substring(0, 97) + '...';
  }
  
  return selector;
}

/**
 * Suggests corrections for common selector issues
 */
export function suggestSelectorFix(selector: string, error?: string): string[] {
  const suggestions: string[] = [];

  // Check for quote issues
  if (selector.includes("'") && selector.includes('"')) {
    suggestions.push('Try using consistent quote types in your selector');
  }

  // Check for attribute selector issues
  const attrMatch = selector.match(/\[([^=\]]+)=([^[\]]+)\]/);
  if (attrMatch && !attrMatch[2].match(/^["'].*["']$/)) {
    suggestions.push(`Try wrapping the attribute value in quotes: [${attrMatch[1]}="${attrMatch[2]}"]`);
  }

  // Check for pseudo-selectors
  if (selector.includes(':visible') || selector.includes(':hidden')) {
    suggestions.push('Playwright does not support jQuery pseudo-selectors. Use waitForSelector with visible/hidden options instead');
  }

  // Check for XPath
  if (selector.startsWith('//') || selector.includes('xpath=')) {
    suggestions.push('Consider using CSS selectors instead of XPath for better performance and readability');
  }

  // Error-specific suggestions
  if (error) {
    if (error.toLowerCase().includes('not visible')) {
      suggestions.push('The element exists but is hidden. Try waiting for it to become visible or check if it needs to be revealed by another action');
    } else if (error.toLowerCase().includes('timeout')) {
      suggestions.push('The selector did not match any elements. Verify the selector is correct and the page has loaded');
    } else if (error.toLowerCase().includes('multiple elements')) {
      suggestions.push('The selector matches multiple elements. Make it more specific or use :first-child, :nth-child(), etc.');
    }
  }

  return suggestions;
}