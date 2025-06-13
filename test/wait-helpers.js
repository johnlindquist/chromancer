import { runChromancer, extractEvaluateResult } from './test-utils.js';

// Wait for navigation to complete by checking if URL changes
export async function waitForUrlChange(expectedUrlPart, timeout = 3000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await runChromancer('evaluate', ['window.location.href']);
    const url = extractEvaluateResult(result.stdout);
    
    if (url && url.includes(expectedUrlPart)) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

// Wait for page title to change
export async function waitForTitleChange(expectedTitle, timeout = 3000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await runChromancer('evaluate', ['document.title']);
    const title = extractEvaluateResult(result.stdout);
    
    if (title && title.includes(expectedTitle)) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

// Wait for element to have specific text
export async function waitForElementText(selector, expectedText, timeout = 3000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await runChromancer('evaluate', [
      `(document.querySelector('${selector}')?.textContent || '').trim()`
    ]);
    const text = extractEvaluateResult(result.stdout);
    
    if (text && text.includes(expectedText)) {
      return { success: true, text };
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { success: false, text: '' };
}

// Wait for element value to be set
export async function waitForElementValue(selector, expectedValue, timeout = 3000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await runChromancer('evaluate', [
      `document.querySelector('${selector}')?.value || ''`
    ]);
    const value = extractEvaluateResult(result.stdout);
    
    if (value === expectedValue || (expectedValue && value.includes(expectedValue))) {
      return { success: true, value };
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { success: false, value: '' };
}

// Generic wait with custom condition
export async function waitForCondition(evaluateScript, timeout = 3000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await runChromancer('evaluate', [evaluateScript]);
    const evalResult = extractEvaluateResult(result.stdout);
    
    if (evalResult === 'true') {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

// Debug helper to log current page state
export async function debugPageState() {
  const url = await runChromancer('evaluate', ['window.location.href']);
  const title = await runChromancer('evaluate', ['document.title']);
  const body = await runChromancer('evaluate', ['document.body?.innerHTML?.substring(0, 200) || "No body"']);
  
  console.log('=== Page State Debug ===');
  console.log('URL:', extractEvaluateResult(url.stdout));
  console.log('Title:', extractEvaluateResult(title.stdout));
  console.log('Body preview:', extractEvaluateResult(body.stdout));
  console.log('=======================');
}