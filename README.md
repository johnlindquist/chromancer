# Chromancer

[![npm version](https://badge.fury.io/js/chromancer.svg)](https://www.npmjs.com/package/chromancer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/chromancer.svg)](https://nodejs.org)

A command-line interface for automating Chrome browser using the Chrome DevTools Protocol. Perfect for web scraping, automation, and testing.

## Features

- 🚀 Spawn Chrome instances with automatic port management
- 🔄 Session management - all commands work with your active Chrome instance
- 🌐 Navigate to URLs with various wait conditions
- 🖱️ Click elements using CSS selectors
- ⌨️ Type text into input fields
- 🔍 Find and inspect elements with detailed information
- 📜 Execute JavaScript in page context
- 📸 Take screenshots (full page or viewport)
- 🛑 Gracefully stop Chrome instances

## Requirements

- Node.js 18.0.0 or higher
- Chrome or Chromium browser installed
- **Windows Users**: Chrome must be installed in the default location or available in PATH

## Installation

### Global Installation (Recommended)

```bash
npm install -g chromancer
```

After installation, you can use `chromancer` from anywhere:

```bash
chromancer spawn https://example.com
chromancer screenshot page.png
chromancer stop
```

### Local Installation

```bash
npm install chromancer
```

Then use with npx:

```bash
npx chromancer spawn https://example.com
```

### Development Setup

```bash
git clone https://github.com/johnlindquist/chromancer.git
cd chromancer
npm install
npm run build
```

## Quick Start

The easiest way to get started is using the `spawn` command:

```bash
# Check version
chromancer --version
```

Then spawn Chrome:

```bash
# Spawn Chrome and open a URL
chromancer spawn https://example.com

# Spawn Chrome in headless mode
chromancer spawn https://example.com --headless

# Spawn Chrome on a specific port
chromancer spawn https://example.com --port 9223
```

The spawn command automatically:
- Finds an available port (defaults to 9222, falls back to 9223-9232)
- Launches Chrome with remote debugging enabled
- Opens the specified URL (or about:blank if none provided)
- Displays the DevTools connection URL
- **Creates an active session that subsequent commands will use automatically**

## Session Management

When you use `spawn`, it creates an active session. All subsequent commands will automatically connect to this Chrome instance without needing to specify the port:

```bash
# Start a session
chromancer spawn https://example.com

# These commands automatically use the spawned Chrome
chromancer navigate https://github.com
chromancer screenshot page.png
chromancer evaluate "document.title"

# Stop the Chrome instance
chromancer stop
```

## Usage

### Spawn Chrome

```bash
# Basic usage
chromancer spawn https://example.com

# With options
chromancer spawn https://example.com --headless
chromancer spawn https://example.com --port 9223
chromancer spawn --user-data-dir /tmp/chrome-profile
```

### Stop Chrome

```bash
# Stop the active Chrome session
chromancer stop
```

### Navigate to a URL

```bash
chromancer navigate https://example.com
chromancer navigate https://example.com --wait-until networkidle0
```

### Click an element

```bash
chromancer click "button.submit"
chromancer click "#login-button" --wait-for-selector
```

### Type text

```bash
chromancer type "input[name=email]" "user@example.com"
chromancer type "#search-box" "search query" --clear-first
```

### Select elements

```bash
chromancer select "button"
chromancer select "a[href]" --attributes
chromancer select ".my-class" --limit 10
```

The select command finds elements matching a CSS selector and provides:
- A unique selector for each element that can be used with click/type commands
- Element visibility status
- Text content, position, and dimensions
- HTML attributes (with --attributes flag)

### Execute JavaScript

```bash
chromancer evaluate "document.title"
chromancer evaluate "document.querySelectorAll('a').length"
```

### Take screenshot

```bash
chromancer screenshot screenshot.png
chromancer screenshot fullpage.png --full-page
```

## Global Options

All commands (except spawn and stop) support these options:

- `-p, --port <number>` - Chrome debugging port (uses active session by default)
- `-h, --host <string>` - Chrome debugging host (default: localhost)
- `-l, --launch` - Launch Chrome automatically if not running

## Example Workflow

```bash
# Spawn Chrome with session
chromancer spawn https://github.com

# Take a screenshot (automatically uses the spawned Chrome)
chromancer screenshot github-home.png

# Find search elements
chromancer select "input"

# Search for something
chromancer type "input[name=q]" "oclif" --clear-first
chromancer click "button[type=submit]"

# Count search results
chromancer evaluate "document.querySelectorAll('.repo-list-item').length"

# Stop Chrome when done
chromancer stop
```

### Tutorial: Automating Google Search

This tutorial shows how to search Google using chromancer in headed mode, which allows you to interact with any CAPTCHAs that may appear:

```bash
# Step 1: Spawn Chrome in headed mode (not headless) so you can see and interact with it
chromancer spawn

# Step 2: Navigate to Google
chromancer navigate https://www.google.com

# Step 3: Type your search query
chromancer type 'textarea[name="q"]' "hello world"

# Step 4: Submit the search (using JavaScript since the button might be hidden)
chromancer evaluate "document.querySelector('textarea[name=\"q\"]').form.submit()"

# Step 5: If a CAPTCHA appears, solve it manually in the browser window

# Step 6: Once past any CAPTCHA, get the search results
chromancer evaluate "Array.from(document.querySelectorAll('h3')).slice(0, 5).map(h => h.textContent).filter(Boolean)"

# Step 7: Take a screenshot of the results
chromancer screenshot google-results.png

# Step 8: Stop Chrome when done
chromancer stop
```

**Important Notes:**
- Use headed mode (don't use `--headless`) so you can interact with CAPTCHAs
- Google often shows CAPTCHAs for automated browsers
- After solving the CAPTCHA manually, continue with the remaining commands
- The search results selector may vary based on Google's current HTML structure

### Alternative: Connect to existing Chrome

If you prefer to manage Chrome manually:

```bash
# Start Chrome manually
# Linux/Mac:
google-chrome --remote-debugging-port=9222

# Windows:
chrome.exe --remote-debugging-port=9222

# Use the CLI commands
chromancer navigate https://example.com --port 9222
```

### Platform-Specific Notes

#### Windows
- Chrome is automatically detected in common installation paths
- The CLI will check the Windows Registry for Chrome location
- Process management uses Windows-specific commands (taskkill)
- Use `.bat` scripts instead of `.sh` scripts for testing

#### macOS
- Supports Chrome, Chromium, and Chrome Canary
- Looks for applications in /Applications folder

#### Linux
- Checks common package manager installation paths
- Supports snap packages (/snap/bin/chromium)

## Testing

### Unit Tests

Run unit tests to verify CLI structure:

```bash
node test/unit-tests.js
```

### Integration Tests

For full integration testing with Chrome:

```bash
# Option 1: Use spawn command
chromancer spawn --headless
node test/test-suite.js

# Option 2: Use Docker Chrome
docker run -d --name chrome-test -p 9222:9222 zenika/alpine-chrome \
  --no-sandbox --remote-debugging-host=0.0.0.0 --remote-debugging-port=9222
node test/test-suite.js
docker stop chrome-test && docker rm chrome-test

# Option 3: Auto-launch Chrome with any command
chromancer navigate https://example.com --launch
```

### Mock Server Test

Test basic connectivity without Chrome:

```bash
node test/mock-chrome-test.js
```

## Troubleshooting

### Chrome not found

If Chromancer can't find Chrome, you can:

1. Make sure Chrome or Chromium is installed
2. Add Chrome to your PATH
3. Use the spawn command which will auto-detect Chrome location

### Port already in use

If the default port (9222) is in use:

```bash
# Use a different port
chromancer spawn --port 9223

# Or stop any existing session
chromancer stop
```

### Permission denied

On Linux/macOS, you might need to make the binary executable:

```bash
chmod +x $(which chromancer)
```

### Debugging connection issues

Use the `--verbose` flag to get detailed logging information:

```bash
# Debug navigation timeouts
chromancer navigate https://example.com --verbose

# Debug connection problems
chromancer spawn --verbose

# See detailed information about page loading
chromancer navigate https://slow-site.com --verbose --timeout 60000
```

The verbose flag provides:
- Detailed connection timing and browser information
- All network requests and responses during navigation
- Page load events and performance metrics
- Error details with stack traces
- Console messages from the page

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © John Lindquist