import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { getTestServer } from './test-helpers.js';

describe('Interactive Command', () => {
  let server;
  
  beforeAll(async () => {
    server = createTestServer(3456);
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });
  
  it('should list interactive elements on page', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Since interactive mode requires user input, we can test the evaluate part
    // that lists all interactive elements
    const expression = `
      const interactiveSelectors = 'a, button, input, select, textarea, [onclick], [role="button"], [role="link"]';
      const elements = Array.from(document.querySelectorAll(interactiveSelectors));
      elements.map((el, i) => ({
        index: i,
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim() || el.value || '',
        id: el.id || '',
        class: el.className || ''
      }))
    `;
    
    const result = await runChromancer('evaluate', [expression]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Form Test');
    expect(result.stdout).toContain('Button Test');
  });
  
  it('should find interactive elements in forms', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Check for form elements
    const expression = `
      const inputs = document.querySelectorAll('input, textarea, select, button');
      Array.from(inputs).map(el => ({
        type: el.type || el.tagName.toLowerCase(),
        id: el.id,
        name: el.name || ''
      }))
    `;
    
    const result = await runChromancer('evaluate', [expression]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('username');
    expect(result.stdout).toContain('email');
    expect(result.stdout).toContain('password');
    expect(result.stdout).toContain('textarea');
    expect(result.stdout).toContain('submit');
  });
  
  it('should identify clickable elements', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Find all buttons
    const expression = `
      const buttons = document.querySelectorAll('button');
      Array.from(buttons).map(btn => ({
        id: btn.id,
        text: btn.textContent,
        disabled: btn.disabled
      }))
    `;
    
    const result = await runChromancer('evaluate', [expression]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('simple-btn');
    expect(result.stdout).toContain('counter-btn');
    expect(result.stdout).toContain('alert-btn');
    expect(result.stdout).toContain('disabled-btn');
  });
  
  it('should handle pages with many interactive elements', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    // Count all interactive elements
    const countExpression = `
      const selectors = 'a, button, input, select, textarea, [onclick], [role="button"]';
      document.querySelectorAll(selectors).length
    `;
    
    const countResult = await runChromancer('evaluate', [countExpression]);
    expect(countResult.success).toBe(true);
    const count = parseInt(countResult.stdout.trim());
    expect(count).toBeGreaterThan(0);
  });
  
  it('should work with dynamically added elements', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Click to add dynamic content
    await runChromancer('click', ['#load-content']);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check for dynamically added button
    const expression = `document.querySelector('#nested-btn') !== null`;
    const result = await runChromancer('evaluate', [expression]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('true');
  });
});