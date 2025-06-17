import { describe, it, expect } from 'vitest';
import { normalizeSelector, isValidSelector, suggestSelectorFix } from '../../src/utils/selector-normalizer.js';

describe('Selector Normalizer', () => {
  describe('normalizeSelector', () => {
    it('should normalize attribute selectors with single quotes', () => {
      const input = "input[type='search']";
      const expected = 'input[type="search"]';
      expect(normalizeSelector(input)).toBe(expected);
    });

    it('should normalize attribute selectors with double quotes', () => {
      const input = 'input[type="search"]';
      const expected = 'input[type="search"]';
      expect(normalizeSelector(input)).toBe(expected);
    });

    it('should normalize attribute selectors with escaped quotes', () => {
      const input = "input[type=\\'search\\']";
      const expected = 'input[type="search"]';
      expect(normalizeSelector(input)).toBe(expected);
    });

    it('should handle multiple attribute selectors', () => {
      const input = "input[type='text'][name='username']";
      const expected = 'input[type="text"][name="username"]';
      expect(normalizeSelector(input)).toBe(expected);
    });

    it('should preserve non-attribute selectors', () => {
      const selectors = [
        '.class-name',
        '#id-name',
        'div > span',
        'ul li:first-child',
        '.parent .child'
      ];

      selectors.forEach(selector => {
        expect(normalizeSelector(selector)).toBe(selector);
      });
    });

    it('should handle complex attribute values', () => {
      const input = "a[href='https://example.com/path?param=value']";
      const expected = 'a[href="https://example.com/path?param=value"]';
      expect(normalizeSelector(input)).toBe(expected);
    });

    it('should trim whitespace', () => {
      const input = "  input[type='search']  ";
      const expected = 'input[type="search"]';
      expect(normalizeSelector(input)).toBe(expected);
    });

    it('should return non-string values as-is', () => {
      const obj = { selector: '.test' };
      expect(normalizeSelector(obj)).toBe(obj);
      expect(normalizeSelector(null)).toBe(null);
      expect(normalizeSelector(undefined)).toBe(undefined);
    });

    it('should handle attribute selectors without quotes', () => {
      const input = 'input[type=search]';
      const expected = 'input[type="search"]';
      expect(normalizeSelector(input)).toBe(expected);
    });

    it('should handle data attributes', () => {
      const input = "div[data-testid='search-box'][data-visible='true']";
      const expected = 'div[data-testid="search-box"][data-visible="true"]';
      expect(normalizeSelector(input)).toBe(expected);
    });
  });

  describe('isValidSelector', () => {
    it('should validate correct selectors', () => {
      const validSelectors = [
        '.class',
        '#id',
        'div',
        'input[type="text"]',
        'a[href*="example"]',
        'ul > li:first-child',
        '.parent .child',
        '[data-testid="component"]'
      ];

      validSelectors.forEach(selector => {
        expect(isValidSelector(selector)).toBe(true);
      });
    });

    it('should reject invalid selectors', () => {
      const invalidSelectors = [
        '',
        '   ',
        null,
        undefined,
        'input[type="text"',  // Unclosed bracket
        'input[type="text]',  // Unclosed quote
        '.class"',            // Extra quote
        '[[[',                // Invalid brackets
      ];

      invalidSelectors.forEach(selector => {
        expect(isValidSelector(selector)).toBe(false);
      });
    });

    it('should detect unbalanced quotes', () => {
      expect(isValidSelector('input[type="search\']')).toBe(false);
      expect(isValidSelector('input[type=\'search"]')).toBe(false);
    });

    it('should handle escaped characters', () => {
      // These selectors have backslashes but are still valid CSS selectors
      expect(isValidSelector('input[value="He said Hello"]')).toBe(true);
      expect(isValidSelector('input[value="It\'s working"]')).toBe(true);
    });
  });

  describe('suggestSelectorFix', () => {
    it('should suggest quote fixes', () => {
      const selector = "input[type='search\"][name=\"field\"]";
      const suggestions = suggestSelectorFix(selector);
      expect(suggestions).toContain('Try using consistent quote types in your selector');
    });

    it('should suggest attribute value quotes', () => {
      const selector = 'input[type=search]';
      const suggestions = suggestSelectorFix(selector);
      expect(suggestions.some(s => s.includes('[type="search"]'))).toBe(true);
    });

    it('should provide visibility error help', () => {
      const selector = '.hidden-element';
      const error = 'Element is not visible';
      const suggestions = suggestSelectorFix(selector, error);
      expect(suggestions.some(s => s.includes('hidden'))).toBe(true);
    });

    it('should provide timeout error help', () => {
      const selector = '#missing';
      const error = 'Timeout 5000ms exceeded';
      const suggestions = suggestSelectorFix(selector, error);
      expect(suggestions.some(s => s.includes('did not match'))).toBe(true);
    });

    it('should detect jQuery pseudo-selectors', () => {
      const selector = 'div:visible';
      const suggestions = suggestSelectorFix(selector);
      expect(suggestions.some(s => s.includes('Playwright does not support jQuery'))).toBe(true);
    });

    it('should suggest CSS over XPath', () => {
      const selector = '//div[@class="test"]';
      const suggestions = suggestSelectorFix(selector);
      expect(suggestions.some(s => s.includes('Consider using CSS selectors'))).toBe(true);
    });

    it('should help with multiple element errors', () => {
      const selector = '.item';
      const error = 'strict mode violation: multiple elements found';
      const suggestions = suggestSelectorFix(selector, error);
      expect(suggestions.some(s => s.includes('more specific'))).toBe(true);
    });
  });
});