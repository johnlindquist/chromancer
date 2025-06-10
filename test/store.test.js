import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';

describe('Store Command', () => {
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
  
  it('should store element text content', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Store element text
    const result = await runChromancer('store', ['--selector', '#main-title', '--as', 'pageTitle']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Stored value as "pageTitle"');
    expect(result.stdout).toContain('Welcome to Test Site');
    
    // Verify stored value can be used in evaluate
    const evalResult = await runChromancer('evaluate', ['chromancer.stored.pageTitle']);
    expect(evalResult.stdout).toContain('Welcome to Test Site');
  });
  
  it('should store evaluation result', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Store current URL
    const result = await runChromancer('store', ['--eval', 'window.location.href', '--as', 'currentUrl']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Stored value as "currentUrl"');
    expect(result.stdout).toContain('form.html');
    
    // Store page title
    const titleResult = await runChromancer('store', ['--eval', 'document.title', '--as', 'formTitle']);
    expect(titleResult.success).toBe(true);
    expect(titleResult.stdout).toContain('Form Test Page');
  });
  
  it('should store input values', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Type in input
    await runChromancer('type', ['#username', 'john_doe']);
    
    // Store the input value
    const result = await runChromancer('store', ['--selector', '#username', '--as', 'username', '--property', 'value']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('john_doe');
    
    // Use stored value in another field
    await runChromancer('type', ['#email', '${chromancer.stored.username}@example.com']);
  });
  
  it('should store multiple values', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Store initial count
    await runChromancer('store', ['--selector', '#count', '--as', 'initialCount']);
    
    // Click button multiple times
    await runChromancer('click', ['#counter-btn']);
    await runChromancer('click', ['#counter-btn']);
    
    // Store new count
    await runChromancer('store', ['--selector', '#count', '--as', 'newCount']);
    
    // Compare values
    const compareResult = await runChromancer('evaluate', [
      'parseInt(chromancer.stored.newCount) - parseInt(chromancer.stored.initialCount)'
    ]);
    expect(compareResult.stdout).toContain('2');
  });
  
  it('should store complex objects', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Store all links data
    const result = await runChromancer('store', [
      '--eval', 
      'Array.from(document.querySelectorAll("a")).map(a => ({ text: a.textContent, href: a.href }))',
      '--as',
      'allLinks'
    ]);
    expect(result.success).toBe(true);
    
    // Access stored array
    const linkCountResult = await runChromancer('evaluate', ['chromancer.stored.allLinks.length']);
    expect(parseInt(linkCountResult.stdout)).toBeGreaterThan(0);
  });
  
  it('should handle attribute storage', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Store element attribute
    const result = await runChromancer('store', [
      '--selector', '#email',
      '--as', 'emailPlaceholder',
      '--attribute', 'placeholder'
    ]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('test@example.com');
  });
  
  it('should list all stored values', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Store some values
    await runChromancer('store', ['--eval', '"test1"', '--as', 'var1']);
    await runChromancer('store', ['--eval', '"test2"', '--as', 'var2']);
    
    // List stored values
    const result = await runChromancer('store', ['--list']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('var1');
    expect(result.stdout).toContain('var2');
    expect(result.stdout).toContain('test1');
    expect(result.stdout).toContain('test2');
  });
  
  it('should clear stored values', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Store a value
    await runChromancer('store', ['--eval', '"test"', '--as', 'tempVar']);
    
    // Clear all stored values
    const result = await runChromancer('store', ['--clear']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Cleared all stored values');
    
    // Verify cleared
    const checkResult = await runChromancer('evaluate', ['typeof chromancer.stored.tempVar']);
    expect(checkResult.stdout).toContain('undefined');
  });
  
  it('should persist values across page navigations', async () => {
    // Store value on first page
    await runChromancer('navigate', [getTestUrl('/index.html')]);
    await runChromancer('store', ['--selector', '#main-title', '--as', 'firstPageTitle']);
    
    // Navigate to another page
    await runChromancer('navigate', [getTestUrl('/form.html')]);
    
    // Value should still be accessible
    const result = await runChromancer('evaluate', ['chromancer.stored.firstPageTitle']);
    expect(result.stdout).toContain('Welcome to Test Site');
  });
});