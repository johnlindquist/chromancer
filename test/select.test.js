import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { getTestServer } from './test-helpers.js';

describe('Select Command', () => {
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
  
  it('should select option by value', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    // Select by value
    const result = await runChromancer('select', ['#single-select', 'uk']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Selected');
    
    // Verify selection
    const valueResult = await runChromancer('evaluate', ['document.getElementById("single-select").value']);
    expect(valueResult.stdout).toContain('uk');
  });
  
  it('should select option by visible text', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    // Select by text
    const result = await runChromancer('select', ['#single-select', 'Canada']);
    expect(result.success).toBe(true);
    
    // Verify selection
    const valueResult = await runChromancer('evaluate', ['document.getElementById("single-select").value']);
    expect(valueResult.stdout).toContain('ca');
  });
  
  it('should handle multiple selections', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    // Select multiple options
    await runChromancer('select', ['#multi-select', 'js']);
    await runChromancer('select', ['#multi-select', 'Python']); // By text
    await runChromancer('select', ['#multi-select', 'go']);
    
    // Verify selections
    const selectedResult = await runChromancer('evaluate', [
      'Array.from(document.getElementById("multi-select").selectedOptions).map(o => o.value)'
    ]);
    expect(selectedResult.stdout).toContain('js');
    expect(selectedResult.stdout).toContain('py');
    expect(selectedResult.stdout).toContain('go');
  });
  
  it('should work with grouped options', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    // Select from grouped options
    const result = await runChromancer('select', ['#grouped-select', 'Sport Bike']);
    expect(result.success).toBe(true);
    
    // Verify selection
    const valueResult = await runChromancer('evaluate', ['document.getElementById("grouped-select").value']);
    expect(valueResult.stdout).toContain('sport');
  });
  
  it('should trigger change events', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    // Select an option
    await runChromancer('select', ['#single-select', 'us']);
    
    // Check that the display was updated
    const displayResult = await runChromancer('evaluate', ['document.getElementById("single-result").textContent']);
    expect(displayResult.stdout).toContain('United States');
    expect(displayResult.stdout).toContain('(us)');
  });
  
  it('should handle non-existent select elements', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    const result = await runChromancer('select', ['#non-existent-select', 'value']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('not found');
  });
  
  it('should handle non-existent option values', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    const result = await runChromancer('select', ['#single-select', 'non-existent-value']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Option');
  });
  
  it('should clear selection when selecting empty value', async () => {
    const url = getTestUrl('/selects.html');
    await runChromancer('navigate', [url]);
    
    // First select something
    await runChromancer('select', ['#single-select', 'us']);
    
    // Then select empty option
    await runChromancer('select', ['#single-select', '']);
    
    // Verify empty selection
    const valueResult = await runChromancer('evaluate', ['document.getElementById("single-select").value']);
    expect(valueResult.stdout).toContain('""');
  });
});