import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitForElement, isElementVisible, getElementInfo } from '../../src/utils/selectors.js';

describe('Selector Utilities', () => {
  let mockPage;
  let mockElement;

  beforeEach(() => {
    mockElement = {
      hover: vi.fn(),
      click: vi.fn(),
      type: vi.fn(),
    };
    
    mockPage = {
      waitForSelector: vi.fn().mockResolvedValue(mockElement),
      $: vi.fn().mockResolvedValue(mockElement),
      $$: vi.fn().mockResolvedValue([mockElement]),
      evaluate: vi.fn(),
    };
  });

  describe('waitForElement', () => {
    it('should wait for element with default timeout', async () => {
      const element = await waitForElement(mockPage, '#test');
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#test', {
        timeout: 30000,
      });
      expect(element).toBe(mockElement);
    });

    it('should wait for element with custom timeout', async () => {
      await waitForElement(mockPage, '.button', { timeout: 5000 });
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.button', {
        timeout: 5000,
      });
    });

    it('should wait for visible element', async () => {
      await waitForElement(mockPage, '#modal', { visible: true });
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#modal', {
        timeout: 30000,
        visible: true,
      });
    });

    it('should wait for hidden element', async () => {
      await waitForElement(mockPage, '#loader', { hidden: true });
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#loader', {
        timeout: 30000,
        hidden: true,
      });
    });

    it('should throw error when element not found', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('TimeoutError: Waiting failed'));
      
      await expect(waitForElement(mockPage, '#missing')).rejects.toThrow('Element not found: #missing');
    });
  });

  describe('isElementVisible', () => {
    it('should return true for visible element', async () => {
      mockPage.evaluate.mockResolvedValue(true);
      
      const visible = await isElementVisible(mockPage, '#visible');
      
      expect(visible).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), '#visible');
    });

    it('should return false for hidden element', async () => {
      mockPage.evaluate.mockResolvedValue(false);
      
      const visible = await isElementVisible(mockPage, '#hidden');
      
      expect(visible).toBe(false);
    });

    it('should return false for non-existent element', async () => {
      mockPage.evaluate.mockResolvedValue(false);
      
      const visible = await isElementVisible(mockPage, '#nonexistent');
      
      expect(visible).toBe(false);
    });
  });

  describe('getElementInfo', () => {
    it('should return element information', async () => {
      const expectedInfo = {
        text: 'Click me',
        value: '',
        tagName: 'BUTTON',
        id: 'submit-btn',
        className: 'btn primary',
        isVisible: true,
        isDisabled: false,
        href: null,
      };
      
      mockPage.evaluate.mockResolvedValue(expectedInfo);
      
      const info = await getElementInfo(mockPage, '#submit-btn');
      
      expect(info).toEqual(expectedInfo);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), mockElement);
    });

    it('should handle input elements', async () => {
      const inputInfo = {
        text: '',
        value: 'test@example.com',
        tagName: 'INPUT',
        id: 'email',
        className: 'form-control',
        isVisible: true,
        isDisabled: false,
        type: 'email',
        placeholder: 'Enter email',
      };
      
      mockPage.evaluate.mockResolvedValue(inputInfo);
      
      const info = await getElementInfo(mockPage, '#email');
      
      expect(info.value).toBe('test@example.com');
      expect(info.type).toBe('email');
    });

    it('should return null for non-existent element', async () => {
      mockPage.$.mockResolvedValue(null);
      
      const info = await getElementInfo(mockPage, '#missing');
      
      expect(info).toBeNull();
    });
  });
});