# Chromancer Test Suite

This directory contains comprehensive Vitest tests for the Chromancer CLI tool.

## Prerequisites

1. **Chrome/Chromium**: Must be installed on your system
2. **Node.js**: Version 18 or higher
3. **Built Project**: Run `npm run build` before testing

## Test Structure

- `fixtures/`: Mock HTML pages for testing various scenarios
  - `index.html`: Main test page with navigation
  - `form.html`: Form input testing
  - `buttons.html`: Click interaction testing
  - `dynamic.html`: Dynamic content testing
  - `selects.html`: Select dropdown testing

- Test files:
  - `navigate.test.js`: Tests for navigation command
  - `click.test.js`: Tests for click interactions
  - `type.test.js`: Tests for typing into inputs
  - `evaluate.test.js`: Tests for JavaScript evaluation
  - `screenshot.test.js`: Tests for screenshot capture
  - `select.test.js`: Tests for select dropdown interactions
  - `interactive.test.js`: Tests for interactive element selection
  - `chromancer.test.js`: General CLI tests

## Running Tests

### Method 1: Using npm scripts
```bash
# Build the project first
npm run build

# Run all tests
npm run test:vitest:run

# Run tests in watch mode
npm run test:vitest

# Run tests with UI
npm run test:vitest:ui
```

### Method 2: Manual setup
```bash
# 1. Start Chrome with remote debugging
chromancer spawn --headless
# Or use Docker:
docker run -d -p 9222:9222 zenika/alpine-chrome --no-sandbox --remote-debugging-host=0.0.0.0 --remote-debugging-port=9222

# 2. Start test server (optional - tests handle this)
npm run test:server

# 3. Run tests
npx vitest run
```

### Method 3: Using the test runner
```bash
node test/run-tests.js
```

## Test Scenarios Covered

1. **Navigation**
   - Navigate to URLs
   - Handle 404 pages
   - Preserve page state

2. **Click Interactions**
   - Click buttons by ID/selector
   - Multiple clicks
   - Click links for navigation
   - Toggle elements
   - Handle disabled buttons

3. **Form Input**
   - Type into text fields
   - Handle different input types (email, password)
   - Type into textareas
   - Clear existing text
   - Special characters

4. **JavaScript Evaluation**
   - Simple expressions
   - DOM access
   - Complex queries
   - Async operations
   - Error handling

5. **Screenshots**
   - Default filename generation
   - Custom filenames
   - Full page captures
   - Element-specific screenshots
   - Different formats (PNG, JPEG)

6. **Select Dropdowns**
   - Select by value
   - Select by visible text
   - Multiple selections
   - Grouped options
   - Change event triggering

7. **Interactive Mode**
   - List interactive elements
   - Find form elements
   - Identify clickable elements
   - Handle dynamic content

## Troubleshooting

1. **Chrome not found**: Ensure Chrome/Chromium is installed and in PATH
2. **Port 9222 in use**: Kill existing Chrome processes or use a different port
3. **Tests timeout**: Increase timeout in `vitest.config.js`
4. **Build errors**: Run `npm run build` before testing

## Writing New Tests

1. Create a new `.test.js` file in the `test/` directory
2. Import test utilities:
   ```javascript
   const { describe, it, expect } = require('vitest');
   const { runChromancer, getTestUrl } = require('./test-utils');
   ```
3. Follow existing test patterns for consistency
4. Add new HTML fixtures if needed in `test/fixtures/`