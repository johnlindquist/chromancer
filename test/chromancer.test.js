import { describe, it, expect } from 'vitest';
import { runChromancer } from './test-utils.js';

describe('Chromancer CLI', () => {
  it('should show help when run without arguments', async () => {
    const result = await runChromancer('--help');
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('chromancer');
    expect(result.stdout).toContain('COMMANDS');
  });
  
  it('should show version', async () => {
    const result = await runChromancer('--version');
    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/chromancer\/\d+\.\d+\.\d+/);
  });
  
  it('should connect to Chrome', async () => {
    // Try to navigate to verify Chrome connection works
    const result = await runChromancer('navigate', ['https://example.com']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Navigated to');
  });
});