# Chromancer

A command-line interface for automating Chrome browser using the Chrome DevTools Protocol. Perfect for web scraping, automation, and testing.

## Features

- Spawn Chrome instances with automatic port management
- Navigate to URLs
- Click elements using CSS selectors
- Type text into input fields
- Execute JavaScript in page context
- Take screenshots (full page or viewport)

## Installation

```bash
npm install
npm run build
```

## Quick Start

The easiest way to get started is using the `spawn` command:

```bash
# Spawn Chrome and open a URL
node ./bin/run.js spawn https://example.com

# Spawn Chrome in headless mode
node ./bin/run.js spawn https://example.com --headless

# Spawn Chrome on a specific port
node ./bin/run.js spawn https://example.com --port 9223
```

The spawn command automatically:
- Finds an available port (defaults to 9222, falls back to 9223-9232)
- Launches Chrome with remote debugging enabled
- Opens the specified URL (or about:blank if none provided)
- Displays the DevTools connection URL

## Usage

### Spawn Chrome

```bash
# Basic usage
node ./bin/run.js spawn https://example.com

# With options
node ./bin/run.js spawn https://example.com --headless
node ./bin/run.js spawn https://example.com --port 9223
node ./bin/run.js spawn --user-data-dir /tmp/chrome-profile
```

### Navigate to a URL

```bash
node ./bin/run.js navigate https://example.com
node ./bin/run.js navigate https://example.com --wait-until networkidle0
```

### Click an element

```bash
node ./bin/run.js click "button.submit"
node ./bin/run.js click "#login-button" --wait-for-selector
```

### Type text

```bash
node ./bin/run.js type "input[name=email]" "user@example.com"
node ./bin/run.js type "#search-box" "search query" --clear-first
```

### Execute JavaScript

```bash
node ./bin/run.js evaluate "document.title"
node ./bin/run.js evaluate "document.querySelectorAll('a').length"
```

### Take screenshot

```bash
node ./bin/run.js screenshot screenshot.png
node ./bin/run.js screenshot fullpage.png --full-page
```

## Global Options

All commands (except spawn) support these options:

- `-p, --port <number>` - Chrome debugging port (default: 9222)
- `-h, --host <string>` - Chrome debugging host (default: localhost)
- `-l, --launch` - Launch Chrome automatically if not running

## Example Workflow

```bash
# Spawn Chrome
node ./bin/run.js spawn https://github.com

# Take a screenshot
node ./bin/run.js screenshot github-home.png

# Search for something
node ./bin/run.js type "input[name=q]" "oclif" --clear-first
node ./bin/run.js click "button[type=submit]"

# Count search results
node ./bin/run.js evaluate "document.querySelectorAll('.repo-list-item').length"
```

### Alternative: Connect to existing Chrome

If you prefer to manage Chrome manually:

```bash
# Start Chrome manually
google-chrome --remote-debugging-port=9222

# Use the CLI commands
node ./bin/run.js navigate https://example.com
```

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
node ./bin/run.js spawn --headless
node test/test-suite.js

# Option 2: Use Docker Chrome
docker run -d --name chrome-test -p 9222:9222 zenika/alpine-chrome \
  --no-sandbox --remote-debugging-host=0.0.0.0 --remote-debugging-port=9222
node test/test-suite.js
docker stop chrome-test && docker rm chrome-test

# Option 3: Auto-launch Chrome with any command
node ./bin/run.js navigate https://example.com --launch
```

### Mock Server Test

Test basic connectivity without Chrome:

```bash
node test/mock-chrome-test.js
```