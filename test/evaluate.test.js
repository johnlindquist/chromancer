import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';

describe('Evaluate Command', () => {
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
  
  it('should evaluate simple expressions', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Evaluate simple math
    const mathResult = await runChromancer('evaluate', ['2 + 2']);
    expect(mathResult.success).toBe(true);
    expect(mathResult.stdout).toContain('4');
    
    // Evaluate string
    const stringResult = await runChromancer('evaluate', ['"Hello" + " " + "World"']);
    expect(stringResult.stdout).toContain('Hello World');
  });
  
  it('should access DOM elements', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Get page title
    const titleResult = await runChromancer('evaluate', ['document.title']);
    expect(titleResult.stdout).toContain('Test Home Page');
    
    // Get element text
    const h1Result = await runChromancer('evaluate', ['document.getElementById("main-title").textContent']);
    expect(h1Result.stdout).toContain('Welcome to Test Site');
    
    // Count elements
    const linkResult = await runChromancer('evaluate', ['document.querySelectorAll(".nav-link").length']);
    expect(linkResult.stdout).toContain('4');
  });
  
  it('should evaluate complex expressions', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Get all link hrefs
    const expression = 'Array.from(document.querySelectorAll("a")).map(a => a.href)';
    const result = await runChromancer('evaluate', [expression]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('form.html');
    expect(result.stdout).toContain('buttons.html');
  });
  
  it('should handle async expressions with --async flag', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Wait for dynamic content
    const asyncExpression = 'await new Promise(r => setTimeout(r, 100)); document.querySelectorAll("li").length';
    const result = await runChromancer('evaluate', [asyncExpression, '--async']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('1'); // Initial item
  });
  
  it('should return different data types', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Boolean
    const boolResult = await runChromancer('evaluate', ['document.body !== null']);
    expect(boolResult.stdout).toContain('true');
    
    // Number
    const numResult = await runChromancer('evaluate', ['window.innerWidth']);
    expect(numResult.stdout).toMatch(/\d+/);
    
    // Object
    const objResult = await runChromancer('evaluate', ['({name: "test", value: 123})']);
    expect(objResult.stdout).toContain('name');
    expect(objResult.stdout).toContain('test');
    expect(objResult.stdout).toContain('123');
  });
  
  it('should handle errors gracefully', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Syntax error
    const result = await runChromancer('evaluate', ['this is not valid javascript']);
    expect(result.success).toBe(false);
    
    // Reference error
    const refResult = await runChromancer('evaluate', ['nonExistentVariable']);
    expect(refResult.success).toBe(false);
  });
  
  it('should work with page state changes', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Check initial count
    const initialResult = await runChromancer('evaluate', ['document.getElementById("count").textContent']);
    expect(initialResult.stdout).toContain('0');
    
    // Click button
    await runChromancer('click', ['#counter-btn']);
    
    // Check updated count
    const updatedResult = await runChromancer('evaluate', ['document.getElementById("count").textContent']);
    expect(updatedResult.stdout).toContain('1');
  });
});