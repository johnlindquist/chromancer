const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

// Helper to run chromancer commands
async function runCommand(cmd) {
  try {
    const { stdout, stderr } = await execAsync(`node ../bin/run.js ${cmd}`);
    return { success: true, stdout, stderr };
  } catch (error) {
    return { success: false, error: error.message, stdout: error.stdout, stderr: error.stderr };
  }
}

// Test suite for new features
async function testNewFeatures() {
  console.log('Testing new chromancer features...\n');
  
  const tests = [
    {
      name: 'Record command - help text',
      test: async () => {
        const result = await runCommand('record --help');
        if (!result.success) throw new Error('Command failed');
        if (!result.stdout.includes('Record user interactions')) {
          throw new Error('Missing command description');
        }
        return { success: true, message: 'Help text correct' };
      }
    },
    {
      name: 'Export command - help text',
      test: async () => {
        const result = await runCommand('export --help');
        if (!result.success) throw new Error('Command failed');
        if (!result.stdout.includes('Export page content')) {
          throw new Error('Missing command description');
        }
        return { success: true, message: 'Help text correct' };
      }
    },
    {
      name: 'Fill command - help text',
      test: async () => {
        const result = await runCommand('fill --help');
        if (!result.success) throw new Error('Command failed');
        if (!result.stdout.includes('Fill form fields')) {
          throw new Error('Missing command description');
        }
        return { success: true, message: 'Help text correct' };
      }
    },
    {
      name: 'Scroll command - help text',
      test: async () => {
        const result = await runCommand('scroll --help');
        if (!result.success) throw new Error('Command failed');
        if (!result.stdout.includes('Scroll the page')) {
          throw new Error('Missing command description');
        }
        return { success: true, message: 'Help text correct' };
      }
    },
    {
      name: 'Cookies command - help text',
      test: async () => {
        const result = await runCommand('cookies --help');
        if (!result.success) throw new Error('Command failed');
        if (!result.stdout.includes('Manage browser cookies')) {
          throw new Error('Missing command description');
        }
        return { success: true, message: 'Help text correct' };
      }
    },
    {
      name: 'PDF command - help text',
      test: async () => {
        const result = await runCommand('pdf --help');
        if (!result.success) throw new Error('Command failed');
        if (!result.stdout.includes('Save page as PDF')) {
          throw new Error('Missing command description');
        }
        return { success: true, message: 'Help text correct' };
      }
    },
    {
      name: 'Network command - help text',
      test: async () => {
        const result = await runCommand('network --help');
        if (!result.success) throw new Error('Command failed');
        if (!result.stdout.includes('Monitor network requests')) {
          throw new Error('Missing command description');
        }
        return { success: true, message: 'Help text correct' };
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of tests) {
    try {
      const result = await test();
      console.log(`✅ ${name}: ${result.message}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Integration tests (requires Chrome)
async function testIntegration() {
  console.log('\nIntegration tests for new features...\n');
  
  // Create test HTML files
  const testDir = path.join(__dirname, 'test-pages');
  await fs.mkdir(testDir, { recursive: true });
  
  // Create form test page
  await fs.writeFile(path.join(testDir, 'form.html'), `
    <html>
    <head><title>Form Test</title></head>
    <body>
      <form id="test-form">
        <input type="text" name="username" id="username" placeholder="Username">
        <input type="email" name="email" id="email" placeholder="Email">
        <input type="password" name="password" id="password" placeholder="Password">
        <select name="country" id="country">
          <option value="">Select Country</option>
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
          <option value="ca">Canada</option>
        </select>
        <textarea name="bio" id="bio" placeholder="Bio"></textarea>
        <input type="checkbox" name="terms" id="terms">
        <label for="terms">Accept Terms</label>
        <button type="submit">Submit</button>
      </form>
    </body>
    </html>
  `);
  
  // Create scrollable page
  await fs.writeFile(path.join(testDir, 'scroll.html'), `
    <html>
    <head><title>Scroll Test</title></head>
    <body>
      <div style="height: 200vh;">
        <h1 id="top">Top of Page</h1>
        <div style="position: absolute; top: 50vh;">
          <h2 id="middle">Middle Section</h2>
        </div>
        <div style="position: absolute; bottom: 0;">
          <h2 id="bottom">Bottom of Page</h2>
        </div>
      </div>
    </body>
    </html>
  `);
  
  // Create data export test page
  await fs.writeFile(path.join(testDir, 'data.html'), `
    <html>
    <head><title>Data Export Test</title></head>
    <body>
      <table id="data-table">
        <thead>
          <tr><th>Name</th><th>Age</th><th>City</th></tr>
        </thead>
        <tbody>
          <tr><td>John Doe</td><td>30</td><td>New York</td></tr>
          <tr><td>Jane Smith</td><td>25</td><td>Los Angeles</td></tr>
          <tr><td>Bob Johnson</td><td>35</td><td>Chicago</td></tr>
        </tbody>
      </table>
      <div id="json-data" data-info='{"status": "active", "count": 42}'></div>
    </body>
    </html>
  `);
  
  console.log('✅ Test pages created');
  
  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
}

// Run tests
async function runTests() {
  const basicTests = await testNewFeatures();
  
  // Only run integration tests if basic tests pass
  if (basicTests) {
    await testIntegration();
  }
  
  process.exit(basicTests ? 0 : 1);
}

if (require.main === module) {
  runTests().catch(console.error);
}