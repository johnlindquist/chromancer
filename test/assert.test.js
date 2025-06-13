import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { getTestServer } from './test-helpers.js';

describe('Assert Command', () => {
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
  
  it('should assert element exists', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Assert element exists - should pass
    const result = await runChromancer('assert', ['--selector', '#main-title']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('✓ Assertion passed');
    expect(result.stdout).toContain('Element exists');
    
    // Assert non-existent element - should fail
    const failResult = await runChromancer('assert', ['--selector', '#non-existent']);
    expect(failResult.success).toBe(false);
    expect(failResult.stderr).toContain('Assertion failed');
    expect(failResult.stderr).toContain('Element not found');
  });
  
  it('should assert text content contains', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Assert contains text - should pass
    const result = await runChromancer('assert', ['--selector', '#main-title', '--contains', 'Welcome']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('✓ Assertion passed');
    expect(result.stdout).toContain('contains "Welcome"');
    
    // Assert wrong text - should fail
    const failResult = await runChromancer('assert', ['--selector', '#main-title', '--contains', 'Goodbye']);
    expect(failResult.success).toBe(false);
    expect(failResult.stderr).toContain('does not contain "Goodbye"');
  });
  
  it('should assert exact text match', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    // Assert exact text - should pass
    const result = await runChromancer('assert', ['--selector', '#count', '--equals', '0']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('equals "0"');
    
    // Click to change value
    await runChromancer('click', ['#counter-btn']);
    
    // Assert new value
    const newResult = await runChromancer('assert', ['--selector', '#count', '--equals', '1']);
    expect(newResult.success).toBe(true);
  });
  
  it('should assert evaluation results', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Assert page title
    const result = await runChromancer('assert', ['--eval', 'document.title', '--equals', 'Form Test Page']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('✓ Assertion passed');
    
    // Assert URL contains
    const urlResult = await runChromancer('assert', ['--eval', 'window.location.href', '--contains', 'form.html']);
    expect(urlResult.success).toBe(true);
  });
  
  it('should assert boolean evaluations', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Assert true condition
    const result = await runChromancer('assert', ['--eval', 'document.querySelectorAll("a").length > 0']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Expression evaluated to true');
    
    // Assert false condition - should fail
    const failResult = await runChromancer('assert', ['--eval', 'document.querySelectorAll("video").length > 0']);
    expect(failResult.success).toBe(false);
    expect(failResult.stderr).toContain('Expression evaluated to false');
  });
  
  it('should assert element count', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Assert count of elements
    const result = await runChromancer('assert', ['--selector', '.nav-link', '--count', '4']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Element count equals 4');
    
    // Wrong count should fail
    const failResult = await runChromancer('assert', ['--selector', '.nav-link', '--count', '10']);
    expect(failResult.success).toBe(false);
    expect(failResult.stderr).toContain('Expected 10 elements, found');
  });
  
  it('should assert element visibility', async () => {
    const url = getTestUrl('/type-edge.html');
    await runChromancer('navigate', [url]);
    
    // Assert element is visible
    const visibleResult = await runChromancer('assert', ['--selector', '#readonly-input', '--visible']);
    expect(visibleResult.success).toBe(true);
    expect(visibleResult.stdout).toContain('Element is visible');
    
    // Assert hidden element is not visible
    const hiddenResult = await runChromancer('assert', ['--selector', '#toggle-input', '--not-visible']);
    expect(hiddenResult.success).toBe(true);
    expect(hiddenResult.stdout).toContain('Element is not visible');
  });
  
  it('should assert input values', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Type value
    await runChromancer('type', ['#username', 'testuser']);
    
    // Assert input value
    const result = await runChromancer('assert', ['--selector', '#username', '--value', 'testuser']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Input value equals "testuser"');
  });
  
  it('should assert with custom error messages', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Assert with custom message
    const result = await runChromancer('assert', [
      '--selector', '#non-existent',
      '--message', 'Critical element missing!'
    ]);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Critical element missing!');
  });
  
  it('should support regex matching', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Assert text matches regex
    const result = await runChromancer('assert', [
      '--selector', '#main-title',
      '--matches', '^Welcome.*Site$'
    ]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('matches pattern');
  });
});