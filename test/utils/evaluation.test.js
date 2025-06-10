import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeEvaluate, evaluateElementProperty, evaluateElementProperties } from '../../src/utils/evaluation.js';

describe('Evaluation Utilities', () => {
  let mockPage;
  let mockElement;

  beforeEach(() => {
    mockElement = {};
    mockPage = {
      evaluate: vi.fn(),
      $: vi.fn().mockResolvedValue(mockElement),
    };
  });

  describe('safeEvaluate', () => {
    it('should evaluate expression successfully', async () => {
      mockPage.evaluate.mockResolvedValue('test result');
      
      const result = await safeEvaluate(mockPage, 'document.title');
      
      expect(result).toBe('test result');
      expect(mockPage.evaluate).toHaveBeenCalledWith('document.title');
    });

    it('should evaluate function successfully', async () => {
      const testFn = () => window.location.href;
      mockPage.evaluate.mockResolvedValue('https://example.com');
      
      const result = await safeEvaluate(mockPage, testFn);
      
      expect(result).toBe('https://example.com');
      expect(mockPage.evaluate).toHaveBeenCalledWith(testFn);
    });

    it('should handle evaluation errors gracefully', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));
      
      await expect(safeEvaluate(mockPage, 'invalid.code')).rejects.toThrow(
        'Failed to evaluate: Evaluation failed'
      );
    });

    it('should handle syntax errors', async () => {
      mockPage.evaluate.mockRejectedValue(new SyntaxError('Unexpected token'));
      
      await expect(safeEvaluate(mockPage, 'bad syntax {')).rejects.toThrow(
        'Invalid JavaScript expression: Unexpected token'
      );
    });
  });

  describe('evaluateElementProperty', () => {
    it('should get element text content', async () => {
      mockPage.evaluate.mockResolvedValue('Button Text');
      
      const result = await evaluateElementProperty(mockPage, mockElement, 'textContent');
      
      expect(result).toBe('Button Text');
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        mockElement,
        'textContent'
      );
    });

    it('should get element value', async () => {
      mockPage.evaluate.mockResolvedValue('input value');
      
      const result = await evaluateElementProperty(mockPage, mockElement, 'value');
      
      expect(result).toBe('input value');
    });

    it('should get element attribute', async () => {
      mockPage.evaluate.mockResolvedValue('https://example.com');
      
      const result = await evaluateElementProperty(mockPage, mockElement, 'href');
      
      expect(result).toBe('https://example.com');
    });

    it('should return null for non-existent property', async () => {
      mockPage.evaluate.mockResolvedValue(null);
      
      const result = await evaluateElementProperty(mockPage, mockElement, 'nonExistent');
      
      expect(result).toBeNull();
    });
  });

  describe('evaluateElementProperties', () => {
    it('should get multiple properties at once', async () => {
      const properties = {
        textContent: 'Click me',
        id: 'submit-btn',
        className: 'btn primary',
        disabled: false,
      };
      mockPage.evaluate.mockResolvedValue(properties);
      
      const result = await evaluateElementProperties(mockPage, mockElement, [
        'textContent',
        'id',
        'className',
        'disabled',
      ]);
      
      expect(result).toEqual(properties);
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        mockElement,
        ['textContent', 'id', 'className', 'disabled']
      );
    });

    it('should handle empty properties array', async () => {
      const result = await evaluateElementProperties(mockPage, mockElement, []);
      
      expect(result).toEqual({});
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should get all default properties when none specified', async () => {
      const defaultProps = {
        textContent: 'Text',
        value: '',
        id: 'element-id',
        className: 'class',
        tagName: 'DIV',
        href: null,
      };
      mockPage.evaluate.mockResolvedValue(defaultProps);
      
      const result = await evaluateElementProperties(mockPage, mockElement);
      
      expect(result).toEqual(defaultProps);
    });
  });
});