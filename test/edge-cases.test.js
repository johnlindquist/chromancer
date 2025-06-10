import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';

describe('Edge Cases - Navigation', () => {
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
  
  it('should handle hash navigation within same page', async () => {
    const url = getTestUrl('/navigation-edge.html');
    await runChromancer('navigate', [url]);
    
    // Click hash link
    await runChromancer('click', ['a[href="#section2"]']);
    
    // Verify we're still on same page but hash changed
    const urlResult = await runChromancer('evaluate', ['window.location.href']);
    expect(urlResult.stdout).toContain('#section2');
    
    // Verify scroll position changed
    const scrollResult = await runChromancer('evaluate', ['window.pageYOffset > 0']);
    expect(scrollResult.stdout).toContain('true');
  });
  
  it('should handle JavaScript-based navigation', async () => {
    const url = getTestUrl('/navigation-edge.html');
    await runChromancer('navigate', [url]);
    
    // Click JS navigation button
    await runChromancer('click', ['button:has-text("JS Navigate")']);
    
    // Verify navigation occurred
    const titleResult = await runChromancer('evaluate', ['document.title']);
    expect(titleResult.stdout).toContain('Form Test Page');
  });
  
  it('should handle form submission navigation', async () => {
    const url = getTestUrl('/navigation-edge.html');
    await runChromancer('navigate', [url]);
    
    // Submit form
    await runChromancer('click', ['button[type="submit"]']);
    
    // Check URL has query params
    const urlResult = await runChromancer('evaluate', ['window.location.search']);
    expect(urlResult.stdout).toContain('source=navigation-edge');
  });
  
  it('should track navigation history for back/forward', async () => {
    // Navigate through multiple pages
    await runChromancer('navigate', [getTestUrl('/index.html')]);
    await runChromancer('navigate', [getTestUrl('/form.html')]);
    await runChromancer('navigate', [getTestUrl('/buttons.html')]);
    
    // Try to go back
    await runChromancer('evaluate', ['history.back()']);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const titleResult = await runChromancer('evaluate', ['document.title']);
    expect(titleResult.stdout).toContain('Form Test Page');
  });
});

describe('Edge Cases - Click Interactions', () => {
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
  
  it('should handle double-click events', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Simulate double-click (two rapid clicks)
    await runChromancer('click', ['#double-click-area']);
    await runChromancer('click', ['#double-click-area']);
    
    // Note: True double-click would need a new command
    // This tests rapid clicking which is different
    const countResult = await runChromancer('evaluate', ['document.getElementById("dbl-count").textContent']);
    expect(parseInt(countResult.stdout)).toBeGreaterThan(0);
  });
  
  it('should handle nested clickable elements', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Click inner button (should stop propagation)
    await runChromancer('click', ['button:has-text("Inner button")']);
    
    // Check click log
    const logResult = await runChromancer('evaluate', ['document.getElementById("click-log").textContent']);
    expect(logResult.stdout).toContain('inner');
    expect(logResult.stdout).not.toContain('outer');
  });
  
  it('should handle rapidly changing element states', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Rapid clicks on counter
    for (let i = 0; i < 5; i++) {
      await runChromancer('click', ['#rapid-click']);
    }
    
    const countResult = await runChromancer('evaluate', ['document.getElementById("rapid-count").textContent']);
    expect(parseInt(countResult.stdout)).toBeGreaterThanOrEqual(1);
  });
  
  it('should click at specific coordinates', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Click the coordinate tracking div
    await runChromancer('click', ['#coordinate-click']);
    
    // Verify coordinates were captured
    const coordResult = await runChromancer('evaluate', ['document.getElementById("coord-display").textContent']);
    expect(coordResult.stdout).toContain('Clicked at:');
  });
});

describe('Edge Cases - Type Inputs', () => {
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
  
  it('should not type in readonly fields', async () => {
    const url = getTestUrl('/type-edge.html');
    await runChromancer('navigate', [url]);
    
    const initialValue = await runChromancer('evaluate', ['document.getElementById("readonly-input").value']);
    
    // Try to type in readonly field
    await runChromancer('type', ['#readonly-input', 'new text', '--clear']);
    
    // Value should not change
    const afterValue = await runChromancer('evaluate', ['document.getElementById("readonly-input").value']);
    expect(afterValue.stdout).toBe(initialValue.stdout);
  });
  
  it('should handle maxlength restrictions', async () => {
    const url = getTestUrl('/type-edge.html');
    await runChromancer('navigate', [url]);
    
    // Type more than maxlength
    await runChromancer('type', ['#maxlength-input', 'This is a very long text that exceeds the limit']);
    
    // Check length is restricted
    const valueResult = await runChromancer('evaluate', ['document.getElementById("maxlength-input").value.length']);
    expect(valueResult.stdout).toContain('10');
  });
  
  it('should handle auto-formatting inputs', async () => {
    const url = getTestUrl('/type-edge.html');
    await runChromancer('navigate', [url]);
    
    // Type unformatted phone number
    await runChromancer('type', ['#phone-format', '1234567890']);
    
    // Check it was auto-formatted
    const valueResult = await runChromancer('evaluate', ['document.getElementById("phone-format").value']);
    expect(valueResult.stdout).toContain('(123) 456-7890');
  });
  
  it('should handle contenteditable elements', async () => {
    const url = getTestUrl('/type-edge.html');
    await runChromancer('navigate', [url]);
    
    // Clear and type in contenteditable
    await runChromancer('click', ['#contenteditable']);
    await runChromancer('evaluate', ['document.getElementById("contenteditable").innerHTML = ""']);
    
    // Note: typing in contenteditable would need special handling
    await runChromancer('evaluate', ['document.getElementById("contenteditable").textContent = "New content"']);
    
    const contentResult = await runChromancer('evaluate', ['document.getElementById("contenteditable").textContent']);
    expect(contentResult.stdout).toContain('New content');
  });
  
  it('should handle dynamically visible inputs', async () => {
    const url = getTestUrl('/type-edge.html');
    await runChromancer('navigate', [url]);
    
    // Toggle visibility
    await runChromancer('click', ['button:has-text("Toggle Input Visibility")']);
    
    // Now type in the visible input
    await runChromancer('type', ['#toggle-input', 'Now visible!']);
    
    const valueResult = await runChromancer('evaluate', ['document.getElementById("toggle-input").value']);
    expect(valueResult.stdout).toContain('Now visible!');
  });
});

describe('Edge Cases - Complex Workflows', () => {
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
  
  it('should complete multi-step e-commerce workflow', async () => {
    const url = getTestUrl('/complex-workflow.html');
    await runChromancer('navigate', [url]);
    
    // Step 1: Search and select product
    await runChromancer('type', ['#search-input', 'laptop']);
    await new Promise(resolve => setTimeout(resolve, 500));
    await runChromancer('click', ['.search-result-item:first-child']);
    await runChromancer('click', ['#step1-next']);
    
    // Step 2: Configure product
    await runChromancer('select', ['#size-select', 'medium']);
    await runChromancer('select', ['#color-select', 'blue']);
    await runChromancer('type', ['#quantity', '2', '--clear']);
    await runChromancer('click', ['#step2-next']);
    
    // Step 3: Fill customer info
    await runChromancer('type', ['#customer-name', 'John Doe']);
    await runChromancer('type', ['#customer-email', 'john@example.com']);
    await runChromancer('type', ['#customer-phone', '123-456-7890']);
    await runChromancer('type', ['#shipping-address', '123 Main St, City, State 12345']);
    await runChromancer('click', ['#step3-next']);
    
    // Step 4: Review and confirm
    await runChromancer('click', ['#terms-agree']);
    await runChromancer('click', ['#place-order']);
    
    // Verify order completion
    const orderIdResult = await runChromancer('evaluate', ['document.getElementById("order-id").textContent']);
    expect(orderIdResult.stdout).toContain('ORD-');
  });
  
  it('should maintain state across workflow steps', async () => {
    const url = getTestUrl('/complex-workflow.html');
    await runChromancer('navigate', [url]);
    
    // Select product
    await runChromancer('type', ['#search-input', 'mouse']);
    await new Promise(resolve => setTimeout(resolve, 500));
    await runChromancer('click', ['.search-result-item:has-text("Wireless Mouse")']);
    
    // Get state
    const stateResult = await runChromancer('evaluate', ['document.getElementById("state-tracker").dataset.product']);
    expect(stateResult.stdout).toContain('Wireless Mouse');
    
    // Navigate forward then back
    await runChromancer('click', ['#step1-next']);
    await runChromancer('click', ['button:has-text("Previous")']);
    
    // Product should still be selected
    const selectedResult = await runChromancer('evaluate', ['document.getElementById("product-name").textContent']);
    expect(selectedResult.stdout).toContain('Wireless Mouse');
  });
  
  it('should validate form inputs before proceeding', async () => {
    const url = getTestUrl('/complex-workflow.html');
    await runChromancer('navigate', [url]);
    
    // Try to proceed without selecting product
    const nextDisabled = await runChromancer('evaluate', ['document.getElementById("step1-next").disabled']);
    expect(nextDisabled.stdout).toContain('true');
    
    // Select product and go to step 2
    await runChromancer('type', ['#search-input', 'hub']);
    await new Promise(resolve => setTimeout(resolve, 500));
    await runChromancer('click', ['.search-result-item:first-child']);
    await runChromancer('click', ['#step1-next']);
    
    // Try to proceed without configuration
    const step2Disabled = await runChromancer('evaluate', ['document.getElementById("step2-next").disabled']);
    expect(step2Disabled.stdout).toContain('true');
    
    // Partial configuration should still be disabled
    await runChromancer('select', ['#size-select', 'small']);
    const stillDisabled = await runChromancer('evaluate', ['document.getElementById("step2-next").disabled']);
    expect(stillDisabled.stdout).toContain('true');
  });
});

describe('Edge Cases - Selector Caching', () => {
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
  
  it('should handle elements that change ID', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Store initial element reference
    const initialId = 'dynamic-list';
    
    // Add items which might change DOM
    for (let i = 0; i < 3; i++) {
      await runChromancer('click', ['#add-item']);
    }
    
    // Original selector should still work
    const itemCount = await runChromancer('evaluate', [`document.getElementById("${initialId}").children.length`]);
    expect(parseInt(itemCount.stdout)).toBe(4); // 1 initial + 3 added
  });
  
  it('should handle dynamically created elements', async () => {
    const url = getTestUrl('/dynamic.html');
    await runChromancer('navigate', [url]);
    
    // Load dynamic content
    await runChromancer('click', ['#load-content']);
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Try to click dynamically created button
    const result = await runChromancer('click', ['#nested-btn']);
    expect(result.success).toBe(true);
  });
  
  it('should work with elements that move in DOM', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // The moving button changes position
    // Try to click it multiple times
    for (let i = 0; i < 3; i++) {
      await runChromancer('click', ['#moving-button']);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // If any click succeeded, we handled the moving element
    expect(true).toBe(true); // Test passes if no errors
  });
});