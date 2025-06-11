import { describe, it, expect } from 'vitest';
import { handleCommandError, isTimeoutError, formatErrorMessage } from '../../src/utils/errors.js';

describe('Error Utilities', () => {
  describe('isTimeoutError', () => {
    it('should identify timeout errors by name', () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should identify timeout errors by message', () => {
      const error = new Error('TimeoutError: Waiting failed');
      
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should identify playwright timeout errors', () => {
      const error = new Error('Waiting failed: timeout 30000ms exceeded');
      
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return false for non-timeout errors', () => {
      const error = new Error('Click failed');
      
      expect(isTimeoutError(error)).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format error message for element not found', () => {
      const message = formatErrorMessage('click', 'Element not found: #button');
      
      expect(message).toBe('Failed to click: Element not found: #button');
    });

    it('should format error message with selector', () => {
      const message = formatErrorMessage('type', 'Cannot type in element', '#input');
      
      expect(message).toBe('Failed to type: Cannot type in element (#input)');
    });

    it('should handle timeout errors specially', () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      
      const message = formatErrorMessage('wait', error.message, '#modal', error);
      
      expect(message).toBe('Timeout waiting for element: #modal');
    });
  });

  describe('handleCommandError', () => {
    it('should create CommandError with proper structure', () => {
      const originalError = new Error('Element not found');
      
      const commandError = handleCommandError(originalError, 'click', '#button');
      
      expect(commandError).toBeInstanceOf(Error);
      expect(commandError.message).toBe('Failed to click: Element not found (#button)');
      expect(commandError.action).toBe('click');
      expect(commandError.selector).toBe('#button');
      expect(commandError.originalError).toBe(originalError);
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Waiting failed');
      timeoutError.name = 'TimeoutError';
      
      const commandError = handleCommandError(timeoutError, 'wait', '.loading');
      
      expect(commandError.message).toBe('Timeout waiting for element: .loading');
      expect(commandError.isTimeout).toBe(true);
    });

    it('should preserve stack trace', () => {
      const originalError = new Error('Test error');
      const stack = originalError.stack;
      
      const commandError = handleCommandError(originalError, 'evaluate');
      
      expect(commandError.stack).toContain(stack);
    });
  });
});