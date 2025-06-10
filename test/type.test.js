import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';

describe('Type Command', () => {
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
  
  it('should type text into input field', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Type into username field
    const typeResult = await runChromancer('type', ['#username', 'testuser']);
    expect(typeResult.success).toBe(true);
    expect(typeResult.stdout).toContain('Typed');
    
    // Verify the value
    const valueResult = await runChromancer('evaluate', ['document.getElementById("username").value']);
    expect(valueResult.stdout).toContain('testuser');
  });
  
  it('should type into different input types', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Type username
    await runChromancer('type', ['#username', 'john_doe']);
    
    // Type email
    await runChromancer('type', ['#email', 'john@example.com']);
    
    // Type password
    await runChromancer('type', ['#password', 'secret123']);
    
    // Verify all values
    const usernameResult = await runChromancer('evaluate', ['document.getElementById("username").value']);
    expect(usernameResult.stdout).toContain('john_doe');
    
    const emailResult = await runChromancer('evaluate', ['document.getElementById("email").value']);
    expect(emailResult.stdout).toContain('john@example.com');
    
    const passwordResult = await runChromancer('evaluate', ['document.getElementById("password").value']);
    expect(passwordResult.stdout).toContain('secret123');
  });
  
  it('should type into textarea', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    const message = 'This is a multi-line\\nmessage\\nfor testing';
    await runChromancer('type', ['#message', message]);
    
    const valueResult = await runChromancer('evaluate', ['document.getElementById("message").value']);
    expect(valueResult.stdout).toContain('This is a multi-line');
    expect(valueResult.stdout).toContain('message');
    expect(valueResult.stdout).toContain('for testing');
  });
  
  it('should clear existing text before typing with --clear flag', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    // Type initial text
    await runChromancer('type', ['#username', 'initial']);
    
    // Type new text with clear
    await runChromancer('type', ['#username', 'replacement', '--clear']);
    
    // Verify only new text exists
    const valueResult = await runChromancer('evaluate', ['document.getElementById("username").value']);
    expect(valueResult.stdout).toContain('replacement');
    expect(valueResult.stdout).not.toContain('initial');
  });
  
  it('should handle special characters', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    const specialText = 'Test@123!#$%';
    await runChromancer('type', ['#username', specialText]);
    
    const valueResult = await runChromancer('evaluate', ['document.getElementById("username").value']);
    expect(valueResult.stdout).toContain(specialText);
  });
  
  it('should fail when typing into non-existent elements', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    const result = await runChromancer('type', ['#non-existent', 'test']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('not found');
  });
});