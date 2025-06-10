import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';

describe('Click Command', () => {
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
  
  it('should click a button by ID', async () => {
    // Navigate to buttons page
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Click the counter button
    const clickResult = await runChromancer('click', ['#counter-btn']);
    expect(clickResult.success).toBe(true);
    expect(clickResult.stdout).toContain('Clicked element');
    
    // Verify counter was incremented
    const countResult = await runChromancer('evaluate', ['document.getElementById("count").textContent']);
    expect(countResult.stdout).toContain('1');
  });
  
  it('should click multiple times', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Click counter button 3 times
    await runChromancer('click', ['#counter-btn']);
    await runChromancer('click', ['#counter-btn']);
    await runChromancer('click', ['#counter-btn']);
    
    // Verify counter is at 3
    const countResult = await runChromancer('evaluate', ['document.getElementById("count").textContent']);
    expect(countResult.stdout).toContain('3');
  });
  
  it('should click links for navigation', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Click form link
    const clickResult = await runChromancer('click', ['a[href="/form.html"]']);
    expect(clickResult.success).toBe(true);
    
    // Verify we're on the form page
    const titleResult = await runChromancer('evaluate', ['document.title']);
    expect(titleResult.stdout).toContain('Form Test Page');
  });
  
  it('should handle click on toggle elements', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Click toggle button
    await runChromancer('click', ['#toggle-btn']);
    
    // Check that content is visible
    const visibleResult = await runChromancer('evaluate', [
      'window.getComputedStyle(document.getElementById("toggle-content")).display'
    ]);
    expect(visibleResult.stdout).toContain('block');
    
    // Click again to hide
    await runChromancer('click', ['#toggle-btn']);
    
    // Check that content is hidden
    const hiddenResult = await runChromancer('evaluate', [
      'window.getComputedStyle(document.getElementById("toggle-content")).display'
    ]);
    expect(hiddenResult.stdout).toContain('none');
  });
  
  it('should fail when clicking non-existent elements', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    const result = await runChromancer('click', ['#non-existent-button']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('not found');
  });
  
  it('should handle disabled buttons', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Try to click disabled button - should succeed but button won't do anything
    const result = await runChromancer('click', ['#disabled-btn']);
    expect(result.success).toBe(true);
  });
});