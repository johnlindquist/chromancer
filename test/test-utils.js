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
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (error) {
    return { 
      stdout: (error.stdout || '').trim(), 
      stderr: (error.stderr || error.message).trim(), 
      success: false,
      error 
    };
  }
}

export function getTestUrl(path = '') {
  return `${TEST_URL}${path}`;
}

// Helper to extract the actual result from evaluate command output
export function extractEvaluateResult(output) {
  const lines = output.split('\n');
  const resultIndex = lines.findIndex(line => line.includes('📤 Result:'));
  if (resultIndex >= 0 && resultIndex + 1 < lines.length) {
    // Return all lines after "Result:" line
    return lines.slice(resultIndex + 1).join('\n').trim();
  }
  return '';
}

// Helper to extract the final URL from navigate command output
export function extractFinalUrl(output) {
  const match = output.match(/🔀 Final URL: (.+)/);
  return match ? match[1] : '';
}

// Helper to extract page title from navigate command output
export function extractPageTitle(output) {
  const match = output.match(/📄 Page title: "(.+)"/);
  return match ? match[1] : '';
}

export async function waitForElement(selector, timeout = 3000) {
  const startTime = Date.now();
  const checkInterval = 50; // Check more frequently
  
  while (Date.now() - startTime < timeout) {
    const result = await runChromancer('evaluate', [`document.querySelector('${selector}') !== null`]);
    const evaluateResult = extractEvaluateResult(result.stdout);
    if (evaluateResult === 'true') {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  return false;
}

// Helper for better error messages in tests
export function expectWithTimeout(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected "${expected}" but got "${actual}"`);
  }
}