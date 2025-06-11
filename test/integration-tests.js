const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

// Helper to run chromancer commands
async function runCommand(cmd, expectFailure = false) {
  try {
    const { stdout, stderr } = await execAsync(`node ../bin/run.js ${cmd}`);
    return { success: true, stdout, stderr };
  } catch (error) {
    if (expectFailure) {
      return { success: false, error: error.message, stdout: error.stdout, stderr: error.stderr };
    }
    throw error;
  }
}

// Integration tests that require Chrome
async function runIntegrationTests() {
  console.log('Running integration tests for new features...\n');
  console.log('⚠️  These tests require Chrome to be running with remote debugging enabled\n');
  
  const tests = [
    {
      name: 'Scroll command - scroll down',
      test: async () => {
        // First navigate to a page
        await runCommand('navigate https://example.com');
        // Then scroll
        const result = await runCommand('scroll down');
        if (!result.success) throw new Error('Scroll command failed');
        if (!result.stdout.includes('Scrolled down')) {
          throw new Error('Expected scroll confirmation');
        }
        return { success: true, message: 'Page scrolled successfully' };
      }
    },
    {
      name: 'Fill command - auto-generate form data',
      test: async () => {
        // Create a test form page
        const formHtml = `
          <html>
          <body>
            <form id="test-form">
              <input type="text" name="username" placeholder="Username">
              <input type="email" name="email" placeholder="Email">
              <button type="submit">Submit</button>
            </form>
          </body>
          </html>
        `;
        
        const testDir = path.join(__dirname, 'temp');
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(path.join(testDir, 'form.html'), formHtml);
        
        await runCommand(`navigate file://${path.join(testDir, 'form.html')}`);
        const result = await runCommand('fill --auto-generate');
        
        await fs.rm(testDir, { recursive: true, force: true });
        
        if (!result.success) throw new Error('Fill command failed');
        if (!result.stdout.includes('Form filled successfully')) {
          throw new Error('Expected fill confirmation');
        }
        return { success: true, message: 'Form filled with auto-generated data' };
      }
    },
    {
      name: 'Export command - export page as text',
      test: async () => {
        await runCommand('navigate https://example.com');
        const outputFile = 'test-export.txt';
        const result = await runCommand(`export --format text --output ${outputFile}`);
        
        if (!result.success) throw new Error('Export command failed');
        
        // Check if file was created
        const exists = await fs.access(outputFile).then(() => true).catch(() => false);
        if (!exists) throw new Error('Export file not created');
        
        // Clean up
        await fs.unlink(outputFile);
        
        return { success: true, message: 'Page exported as text' };
      }
    },
    {
      name: 'Cookies command - list cookies',
      test: async () => {
        await runCommand('navigate https://example.com');
        const result = await runCommand('cookies list');
        
        if (!result.success) throw new Error('Cookies command failed');
        // Example.com might not set cookies, so just check command runs
        return { success: true, message: 'Cookie listing works' };
      }
    },
    {
      name: 'PDF command - save page as PDF',
      test: async () => {
        await runCommand('navigate https://example.com');
        const outputFile = 'test-page.pdf';
        const result = await runCommand(`pdf --output ${outputFile}`);
        
        if (!result.success) throw new Error('PDF command failed');
        
        // Check if file was created
        const exists = await fs.access(outputFile).then(() => true).catch(() => false);
        if (!exists) throw new Error('PDF file not created');
        
        // Check file size
        const stats = await fs.stat(outputFile);
        if (stats.size === 0) throw new Error('PDF file is empty');
        
        // Clean up
        await fs.unlink(outputFile);
        
        return { success: true, message: 'Page saved as PDF' };
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  const failedTests = [];
  
  // Check if Chrome is running first
  try {
    await runCommand('navigate https://example.com');
  } catch (error) {
    console.log('❌ Chrome is not running or not accessible');
    console.log('Please start Chrome with: chromancer spawn --headless');
    return false;
  }
  
  for (const { name, test } of tests) {
    try {
      const result = await test();
      console.log(`✅ ${name}: ${result.message}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
      failedTests.push({ name, error: error.message });
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    failedTests.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }
  
  return failed === 0;
}

// Run tests
if (require.main === module) {
  runIntegrationTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}