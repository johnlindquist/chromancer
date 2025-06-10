import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let chromeProcess;

// Global setup - runs once before all tests
export async function setup() {
  console.log('Building project before tests...');
  await execAsync('npm run build');
  
  console.log('Starting Chrome with remote debugging...');
  
  // First, kill any existing Chrome processes on port 9222
  try {
    await execAsync('lsof -ti:9222 | xargs kill -9');
  } catch (e) {
    // Ignore if no process found
  }
  
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
  
  while (!ready && attempts < 30) {
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }
  
  if (!ready) {
    throw new Error('Chrome failed to start after 30 seconds');
  }
}

// Global teardown - runs once after all tests
export async function teardown() {
  console.log('Stopping Chrome...');
  
  if (chromeProcess) {
    chromeProcess.kill('SIGTERM');
    
    // Give it time to shut down gracefully
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force kill if still running
    try {
      chromeProcess.kill('SIGKILL');
    } catch (e) {
      // Already dead
    }
  }
  
  // Clean up any orphaned Chrome processes
  try {
    await execAsync('pkill -f "chrome.*remote-debugging"');
  } catch (e) {
    // Ignore if no processes found
  }
}