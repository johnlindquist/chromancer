import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runChromancer, getTestUrl } from './test-utils.js';
import { createTestServer } from './test-server.js';
import fs from 'fs/promises';
import path from 'path';

describe('Screenshot Command', () => {
  let server;
  const screenshotDir = path.join(process.cwd(), 'test-screenshots');
  
  beforeAll(async () => {
    server = createTestServer(3456);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create screenshot directory
    await fs.mkdir(screenshotDir, { recursive: true });
  });
  
  afterAll(async () => {
    if (server) {
      await server.close();
    }
    
    // Clean up screenshots
    try {
      await fs.rm(screenshotDir, { recursive: true });
    } catch (e) {
      // Ignore if doesn't exist
    }
  });
  
  it('should take a screenshot with default filename', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    const result = await runChromancer('screenshot');
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Screenshot saved');
    expect(result.stdout).toMatch(/screenshot-\d+\.png/);
  });
  
  it('should take a screenshot with custom filename', async () => {
    const url = getTestUrl('/buttons.html');
    await runChromancer('navigate', [url]);
    
    const filename = path.join(screenshotDir, 'buttons-test.png');
    const result = await runChromancer('screenshot', [filename]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('buttons-test.png');
    
    // Verify file exists
    const stats = await fs.stat(filename);
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(0);
  });
  
  it('should take fullpage screenshot with --fullpage flag', async () => {
    const url = getTestUrl('/form.html');
    await runChromancer('navigate', [url]);
    
    const filename = path.join(screenshotDir, 'fullpage.png');
    const result = await runChromancer('screenshot', [filename, '--fullpage']);
    expect(result.success).toBe(true);
    
    // Fullpage screenshots are typically larger
    const stats = await fs.stat(filename);
    expect(stats.size).toBeGreaterThan(0);
  });
  
  it('should capture element screenshot with --selector', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    const filename = path.join(screenshotDir, 'element.png');
    const result = await runChromancer('screenshot', [filename, '--selector', '#main-title']);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('element.png');
    
    // Element screenshots should be smaller than full page
    const stats = await fs.stat(filename);
    expect(stats.isFile()).toBe(true);
  });
  
  it('should handle different image formats', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    // JPEG format
    const jpegFile = path.join(screenshotDir, 'test.jpg');
    const jpegResult = await runChromancer('screenshot', [jpegFile]);
    expect(jpegResult.success).toBe(true);
    
    const jpegStats = await fs.stat(jpegFile);
    expect(jpegStats.isFile()).toBe(true);
  });
  
  it('should fail when selector not found', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    const filename = path.join(screenshotDir, 'fail.png');
    const result = await runChromancer('screenshot', [filename, '--selector', '#non-existent']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('not found');
  });
  
  it('should create directory if it does not exist', async () => {
    const url = getTestUrl('/index.html');
    await runChromancer('navigate', [url]);
    
    const nestedPath = path.join(screenshotDir, 'nested', 'dir', 'screenshot.png');
    const result = await runChromancer('screenshot', [nestedPath]);
    expect(result.success).toBe(true);
    
    const stats = await fs.stat(nestedPath);
    expect(stats.isFile()).toBe(true);
  });
});