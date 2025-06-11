// Test to reproduce the hanging issue
const { chromium } = require('playwright');

async function testHanging() {
  console.log('Starting test...');
  
  // Simulate what navigate does
  const browser = await chromium.connectOverCDP('http://localhost:9222').catch(() => null);
  
  if (!browser) {
    console.log('No Chrome running, testing process exit...');
    // The issue: process doesn't exit
    console.log('This should exit immediately');
    // process.exit(0); // Uncommenting this would fix it
    return;
  }
  
  console.log('Connected to browser');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  
  await page.goto('https://google.com');
  console.log('Navigated to Google');
  
  // The issue: process hangs here
  console.log('Done - but process will hang');
  // await browser.close(); // This would close the browser
  // process.exit(0); // This would force exit
}

testHanging();

// Check if process is hanging
setTimeout(() => {
  console.error('ERROR: Process is still running after 5 seconds!');
  process.exit(1);
}, 5000);