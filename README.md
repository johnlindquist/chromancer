# Chrome DevTools Protocol CLI

A command-line interface for automating Chrome browser using the Chrome DevTools Protocol. Perfect for web scraping, automation, and testing.

## Features

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

## Prerequisites

Start Chrome with remote debugging enabled:

```bash
# Headless mode
google-chrome --remote-debugging-port=9222 --headless=new

# Or with GUI
google-chrome --remote-debugging-port=9222
```

## Usage

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

All commands support these options:

- `-p, --port <number>` - Chrome debugging port (default: 9222)
- `-h, --host <string>` - Chrome debugging host (default: localhost)

## Example Workflow

```bash
# Start Chrome
google-chrome --remote-debugging-port=9222 --headless=new

# Navigate to a website
node ./bin/run.js navigate https://github.com

# Take a screenshot
node ./bin/run.js screenshot github-home.png

# Search for something
node ./bin/run.js type "input[name=q]" "oclif" --clear-first
node ./bin/run.js click "button[type=submit]"

# Count search results
node ./bin/run.js evaluate "document.querySelectorAll('.repo-list-item').length"
```

## Testing

Run the test script:

```bash
./test-cli.sh
```