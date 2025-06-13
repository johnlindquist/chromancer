import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupTestEnvironment, teardownTestEnvironment } from './test-helpers.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let chromeProcess;

// Global setup - runs once before all tests
export async function setup() {
  console.log('Building project before tests...');
  await execAsync('npm run build');
  
  // Check if Chrome is already running on port 9222
  let chromeAlreadyRunning = false;
  try {
    const { stdout } = await execAsync('curl -s http://localhost:9222/json/version');
    if (stdout.includes('Chrome')) {
      chromeAlreadyRunning = true;
      console.log('Chrome is already running on port 9222, using existing instance');
    }
  } catch (e) {
    // Chrome not running, we'll start it
  }
  
  if (!chromeAlreadyRunning) {
    console.log('Starting Chrome with remote debugging...');
    
    // Use the chromancer spawn command
    const chromancerPath = path.join(__dirname, '..', 'bin', 'run.js');
    chromeProcess = spawn('node', [chromancerPath, 'spawn', '--headless'], {
      stdio: 'pipe',
      detached: false
    });
    
    // Wait for Chrome to be ready
    console.log('Waiting for Chrome to start...');
    let ready = false;
    let attempts = 0;
    
    while (!ready && attempts < 10) {  // Reduced from 30 to 10 attempts
      try {
        const { stdout } = await execAsync('curl -s http://localhost:9222/json/version');
        if (stdout.includes('Chrome')) {
          ready = true;
          console.log('Chrome is ready!');
        }
      } catch (e) {
        // Not ready yet
      }
      
      if (!ready) {
        await new Promise(resolve => setTimeout(resolve, 500));  // Check more frequently
        attempts++;
      }
    }
    
    if (!ready) {
      throw new Error('Chrome failed to start after 5 seconds');
    }
  }
  
  // Setup shared test environment (server, etc)
  await setupTestEnvironment();
}

// Global teardown - runs once after all tests
export async function teardown() {
  if (chromeProcess) {
    console.log('Stopping Chrome that we started...');
    chromeProcess.kill('SIGTERM');
    
    // Give it time to shut down gracefully
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Force kill if still running
    try {
      chromeProcess.kill('SIGKILL');
    } catch (e) {
      // Already dead
    }
  } else {
    console.log('Chrome was already running, leaving it as is');
  }
  
  // Cleanup shared test environment
  await teardownTestEnvironment();
}