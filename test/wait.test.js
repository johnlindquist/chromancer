import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';

describe('Wait Command', () => {
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
  
  it('should wait for element to appear', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Click button that loads content after delay
    await runChromancer('click', ['#load-content']);
    
    // Wait for dynamically loaded element
    const result = await runChromancer('wait', ['--selector', '#nested-btn']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Element found');
    
    // Verify element is now clickable
    const clickResult = await runChromancer('click', ['#nested-btn']);
    expect(clickResult.success).toBe(true);
  });
  
  it('should wait with custom timeout', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Try to wait for non-existent element with short timeout
    const result = await runChromancer('wait', ['--selector', '#non-existent', '--timeout', '1000']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Timeout waiting for element');
  });
  
  it('should wait for element to be visible', async () => {
    const url = getTestUrl('/type-edge.html');
    await runChromancer('navigate', [url]);
    
    // Element exists but is hidden
    const existsResult = await runChromancer('evaluate', ['document.getElementById("toggle-input") !== null']);
    expect(existsResult.stdout).toContain('true');
    
    // Click to show element
    await runChromancer('click', ['button:has-text("Toggle Input Visibility")']);
    
    // Wait for visibility
    const result = await runChromancer('wait', ['--selector', '#toggle-input', '--visible']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Element is visible');
  });
  
  it('should wait for custom condition', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Start timer
    await runChromancer('click', ['#start-timer']);
    
    // Wait for timer to reach specific value
    const result = await runChromancer('wait', [
      '--condition', 'parseInt(document.getElementById("timer").textContent) >= 2'
    ]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Condition met');
    
    // Verify timer value
    const timerResult = await runChromancer('evaluate', ['document.getElementById("timer").textContent']);
    const timerValue = parseInt(timerResult.stdout);
    expect(timerValue).toBeGreaterThanOrEqual(2);
  });
  
  it('should wait for element to disappear', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Show context menu
    await runChromancer('evaluate', [`
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      document.getElementById('right-click-area').dispatchEvent(event);
    `]);
    
    // Verify menu is visible
    const visibleResult = await runChromancer('evaluate', [
      'window.getComputedStyle(document.getElementById("custom-context-menu")).display'
    ]);
    expect(visibleResult.stdout).toContain('block');
    
    // Click elsewhere to hide menu
    await runChromancer('click', ['body']);
    
    // Wait for menu to disappear
    const result = await runChromancer('wait', ['--selector', '#custom-context-menu', '--hidden']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Element is hidden');
  });
  
  it('should wait for page load', async () => {
    // Navigate to a page
    await runChromancer('navigate', [getTestUrl('/index.html')]);
    
    // Wait for complete page load
    const result = await runChromancer('wait', ['--page-load']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Page loaded');
  });
  
  it('should wait for network idle', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Wait for network to be idle (no pending requests)
    const result = await runChromancer('wait', ['--network-idle', '--timeout', '5000']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Network idle');
  });
  
  it('should support multiple wait conditions', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Click to load content
    await runChromancer('click', ['#load-content']);
    
    // Wait for element AND custom condition
    const result = await runChromancer('wait', [
      '--selector', '#nested-btn',
      '--condition', 'document.querySelectorAll(".loaded-content").length > 0'
    ]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('All conditions met');
  });
});