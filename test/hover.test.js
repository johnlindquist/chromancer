import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { getTestServer } from './test-helpers.js';

describe('Hover Command', () => {
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
  
  it('should hover over element and trigger hover state', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Verify initial state
    const initialState = await runChromancer('evaluate', ['document.getElementById("hover-state").textContent']);
    expect(initialState.stdout).toContain('Not hovered');
    
    // Hover over element
    const result = await runChromancer('hover', ['#hover-div']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Hovered over element');
    
    // Verify hover state changed
    const hoverState = await runChromancer('evaluate', ['document.getElementById("hover-state").textContent']);
    expect(hoverState.stdout).toContain('Hovered!');
  });
  
  it('should hover with duration', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Hover for specific duration
    const result = await runChromancer('hover', ['#hover-div', '--duration', '1000']);
    expect(result.success).toBe(true);
    
    // Should still be hovered after 500ms
    await new Promise(resolve => setTimeout(resolve, 500));
    const midState = await runChromancer('evaluate', ['document.getElementById("hover-state").textContent']);
    expect(midState.stdout).toContain('Hovered!');
  });
  
  it('should trigger CSS hover effects', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Hover over link to trigger CSS :hover
    const result = await runChromancer('hover', ['.nav-link:first-child']);
    expect(result.success).toBe(true);
    
    // In real scenario, CSS hover state would change styles
    // We can verify the element was found and hovered
    expect(result.stdout).toContain('Hovered over element');
  });
  
  it('should show tooltips on hover', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Add a tooltip element for testing
    await runChromancer('evaluate', [`
      const link = document.querySelector('.nav-link');
      link.title = 'This is a tooltip';
      link.setAttribute('data-tooltip', 'Custom tooltip');
    `]);
    
    // Hover to show tooltip
    const result = await runChromancer('hover', ['.nav-link']);
    expect(result.success).toBe(true);
  });
  
  it('should handle hover on moving elements', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Try to hover on moving button
    const result = await runChromancer('hover', ['#moving-button']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Hovered over element');
  });
  
  it('should fail when hovering non-existent elements', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    const result = await runChromancer('hover', ['#non-existent-element']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Element not found');
  });
  
  it('should hover and then move away', async () => {
    const url = getTestUrl('/click-edge.html');
    await runChromancer('navigate', [url]);
    
    // Hover over element
    await runChromancer('hover', ['#hover-div']);
    
    // Verify hovered
    const hoverState = await runChromancer('evaluate', ['document.getElementById("hover-state").textContent']);
    expect(hoverState.stdout).toContain('Hovered!');
    
    // Move mouse away by hovering on body
    await runChromancer('hover', ['body']);
    
    // Verify no longer hovered
    await new Promise(resolve => setTimeout(resolve, 100));
    const afterState = await runChromancer('evaluate', ['document.getElementById("hover-state").textContent']);
    expect(afterState.stdout).toContain('Not hovered');
  });
  
  it('should work with dropdown menus', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // Create a dropdown menu for testing
    await runChromancer('evaluate', [`
      const nav = document.querySelector('nav');
      nav.innerHTML = \`
        <div class="dropdown" style="position: relative;">
          <button class="dropdown-toggle">Menu</button>
          <div class="dropdown-menu" style="display: none; position: absolute;">
            <a href="#1">Option 1</a>
            <a href="#2">Option 2</a>
          </div>
        </div>
      \`;
      
      // Add hover effect
      const dropdown = document.querySelector('.dropdown');
      dropdown.addEventListener('mouseenter', () => {
        document.querySelector('.dropdown-menu').style.display = 'block';
      });
      dropdown.addEventListener('mouseleave', () => {
        document.querySelector('.dropdown-menu').style.display = 'none';
      });
    `]);
    
    // Hover to show dropdown
    const result = await runChromancer('hover', ['.dropdown-toggle']);
    expect(result.success).toBe(true);
    
    // Verify dropdown is visible
    const menuVisible = await runChromancer('evaluate', [
      'window.getComputedStyle(document.querySelector(".dropdown-menu")).display'
    ]);
    expect(menuVisible.stdout).toContain('block');
  });
});