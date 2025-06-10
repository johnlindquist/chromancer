import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROMANCER_BIN = path.join(__dirname, '..', 'bin', 'run.js');
const TEST_URL = 'http://localhost:3456';

export async function runChromancer(command, args = []) {
  const cmdArgs = [command, ...args].join(' ');
  const fullCommand = `node ${CHROMANCER_BIN} ${cmdArgs}`;
  
  try {
    const { stdout, stderr } = await execAsync(fullCommand);
    return { stdout, stderr, success: true };
  } catch (error) {
    return { 
      stdout: error.stdout || '', 
      stderr: error.stderr || error.message, 
      success: false,
      error 
    };
  }
}

export function getTestUrl(path = '') {
  return `${TEST_URL}${path}`;
}

export async function waitForElement(selector, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await runChromancer('evaluate', [`document.querySelector('${selector}') !== null`]);
    if (result.stdout.includes('true')) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}