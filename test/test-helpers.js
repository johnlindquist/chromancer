import { createTestServer } from './test-server.js';
import { runChromancer } from './test-utils.js';

// Shared server instance across all tests
let sharedServer = null;
let serverPort = 3456;

export async function getTestServer() {
  if (!sharedServer) {
    sharedServer = createTestServer(serverPort);
    // Wait for server to be ready
    await waitForServer(serverPort);
  }
  return sharedServer;
}

export async function cleanupTestServer() {
  if (sharedServer) {
    try {
      await sharedServer.close();
    } catch (e) {
      // Server already closed
    }
    sharedServer = null;
  }
}

async function waitForServer(port, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Test server failed to start on port ${port}`);
}

// Helper to wait for navigation to complete
export async function waitForNavigation(timeoutMs = 500) {
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

// Helper to wait for page to be ready after navigation
export async function waitForPageReady(selector = 'body', maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await runChromancer('evaluate', [`document.querySelector('${selector}') !== null`]);
    if (result.stdout.includes('true')) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

// Helper to wait for element to have specific text
export async function waitForElementText(selector, expectedText, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await runChromancer('evaluate', [`document.querySelector('${selector}')?.textContent || ''`]);
    if (result.stdout.includes(expectedText)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

// Global setup hook for vitest
export async function setupTestEnvironment() {
  // Ensure test server is started
  await getTestServer();
}

// Global teardown hook for vitest
export async function teardownTestEnvironment() {
  await cleanupTestServer();
}