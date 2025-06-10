import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';

describe('Navigate Command', () => {
  let server;
  
  beforeAll(async () => {
    server = createTestServer(3456);
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });
  
  it('should navigate to a URL', async () => {
    const url = getTestUrl('/index.html');
    const result = await runChromancer('navigate', [url]);
    
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Navigated to');
    expect(result.stdout).toContain(url);
  });
  
  it('should navigate to different pages', async () => {
    // First navigate to index
    const indexUrl = getTestUrl('/index.html');
    const indexResult = await runChromancer('navigate', [indexUrl]);
    expect(indexResult.success).toBe(true);
    
    // Then navigate to form page
    const formUrl = getTestUrl('/form.html');
    const formResult = await runChromancer('navigate', [formUrl]);
    expect(formResult.success).toBe(true);
    expect(formResult.stdout).toContain(formUrl);
  });
  
  it('should handle 404 pages', async () => {
    const url = getTestUrl('/non-existent.html');
    const result = await runChromancer('navigate', [url]);
    
    // Navigation should still succeed even for 404
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Navigated to');
  });
  
  it('should preserve page state after navigation', async () => {
    // Navigate to buttons page
    const url = getTestUrl('/buttons.html');
    const navResult = await runChromancer('navigate', [url]);
    expect(navResult.success).toBe(true);
    
    // Check that we can evaluate on the page
    const evalResult = await runChromancer('evaluate', ['document.title']);
    expect(evalResult.success).toBe(true);
    expect(evalResult.stdout).toContain('Button Test Page');
  });
});