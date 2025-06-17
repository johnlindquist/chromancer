import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowExecutor } from '../src/utils/workflow-executor.js';
import * as yaml from 'yaml';

describe('Workflow Selector Handling', () => {
  let mockPage;
  let executor;

  beforeEach(() => {
    mockPage = {
      url: vi.fn().mockReturnValue('https://example.com'),
      title: vi.fn().mockResolvedValue('Test Page'),
      goto: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue({}),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue([]),
      screenshot: vi.fn().mockResolvedValue(undefined)
    };
    
    executor = new WorkflowExecutor(mockPage);
  });

  describe('YAML parsing with various quote styles', () => {
    it('should handle single quotes in YAML', async () => {
      const yamlContent = `
- wait: input[type='search']
- click: button[data-testid='submit']
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('input[type="search"]', expect.any(Object));
      expect(mockPage.click).toHaveBeenCalledWith('button[data-testid="submit"]', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });

    it('should handle double quotes in YAML', async () => {
      const yamlContent = `
- wait: input[type="search"]
- click: button[data-testid="submit"]
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('input[type="search"]', expect.any(Object));
      expect(mockPage.click).toHaveBeenCalledWith('button[data-testid="submit"]', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });

    it('should handle no quotes in YAML', async () => {
      const yamlContent = `
- wait: input[type=search]
- click: button[data-testid=submit]
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('input[type="search"]', expect.any(Object));
      expect(mockPage.click).toHaveBeenCalledWith('button[data-testid="submit"]', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });

    it('should handle escaped quotes from AI-generated YAML', async () => {
      // This simulates what Claude might generate when trying to be careful about quotes
      const yamlContent = `
- wait: input[type=\\'search\\']
- click: button[data-testid=\\'submit\\']
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('input[type="search"]', expect.any(Object));
      expect(mockPage.click).toHaveBeenCalledWith('button[data-testid="submit"]', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });

    it('should handle complex selectors with URLs', async () => {
      const yamlContent = `
- click: a[href='https://example.com/path']
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.click).toHaveBeenCalledWith('a[href="https://example.com/path"]', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });

    it('should handle object format with selectors', async () => {
      const yamlContent = `
- wait:
    selector: input[type='search']
    timeout: 5000
- type:
    selector: input[name='username']
    text: testuser
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('input[type="search"]', expect.objectContaining({
        timeout: 5000
      }));
      expect(mockPage.type).toHaveBeenCalledWith('input[name="username"]', 'testuser', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });
  });

  describe('Error handling for invalid selectors', () => {
    it('should provide helpful error for invalid selectors', async () => {
      const yamlContent = `
- click: ""
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(result.failedSteps).toBe(1);
      expect(result.steps[0].error).toContain('Invalid selector');
    });

    it('should handle selector errors gracefully', async () => {
      mockPage.click.mockRejectedValue(new Error('No element matches selector'));
      
      const yamlContent = `
- click: "#non-existent"
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(result.failedSteps).toBe(1);
      expect(result.steps[0].error).toContain('No element matches selector');
    });
  });

  describe('Special cases from real-world usage', () => {
    it('should handle the egghead.io search example', async () => {
      const yamlContent = `
- navigate: https://egghead.io
- wait: input[type="search"]
- type:
    selector: input[type="search"]
    text: Cursor
- evaluate: |
    Array.from(document.querySelectorAll('h3')).map(el => el.textContent.trim())
`;
      const workflow = yaml.parse(yamlContent);
      
      mockPage.evaluate.mockResolvedValue(['Title 1', 'Title 2']);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('input[type="search"]', expect.any(Object));
      expect(mockPage.type).toHaveBeenCalledWith('input[type="search"]', 'Cursor', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });

    it('should handle multiple attribute selectors', async () => {
      const yamlContent = `
- click: input[type="submit"][name="login"]
- wait: div[data-testid="dashboard"][data-visible="true"]
`;
      const workflow = yaml.parse(yamlContent);
      
      const result = await executor.execute(workflow);
      
      expect(mockPage.click).toHaveBeenCalledWith('input[type="submit"][name="login"]', expect.any(Object));
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('div[data-testid="dashboard"][data-visible="true"]', expect.any(Object));
      expect(result.failedSteps).toBe(0);
    });
  });
});