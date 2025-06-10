# New Chromancer Features

## Overview
Added 8 powerful new commands to chromancer, enhancing its capabilities for browser automation, testing, and web scraping.

## New Commands

### 1. **record** - Record user interactions
- Records clicks, typing, navigation, and form interactions
- Generates replayable scripts in JSON or JavaScript format
- Configurable recording duration
- Perfect for creating automated tests from manual interactions

Example:
```bash
chromancer record --output recording.json
chromancer record --output script.js --format js --duration 30000
```

### 2. **export** - Export page content
- Export pages as HTML, JSON, CSV, Markdown, or plain text
- Target specific elements with CSS selectors
- Download all page resources (images, scripts, styles)
- Include computed styles in HTML exports

Example:
```bash
chromancer export --format json --selector "table#data"
chromancer export --format csv --selector "table" --output data.csv
chromancer export --format markdown --output content.md
chromancer export --all-resources --output-dir ./export
```

### 3. **fill** - Automated form filling
- Fill forms with JSON data
- Auto-generate test data based on field types and names
- Support for all input types including files and checkboxes
- Optional form submission after filling

Example:
```bash
chromancer fill --data '{"username": "john", "email": "john@example.com"}'
chromancer fill --file form-data.json --submit
chromancer fill --auto-generate --selector "#login-form"
```

### 4. **scroll** - Page scrolling
- Scroll by direction, pixels, or percentage
- Scroll to specific elements
- Smooth or instant scrolling
- Support for horizontal and vertical scrolling

Example:
```bash
chromancer scroll down
chromancer scroll --to "#section3" --smooth
chromancer scroll --by 500
chromancer scroll --percent 50
```

### 5. **cookies** - Cookie management
- List, get, set, and delete cookies
- Save cookies to file for session persistence
- Load cookies from file
- Support for all cookie attributes (secure, httpOnly, sameSite)

Example:
```bash
chromancer cookies list
chromancer cookies set sessionId=abc123
chromancer cookies save --output cookies.json
chromancer cookies load --file cookies.json
chromancer cookies clear
```

### 6. **pdf** - PDF generation
- Save any page as PDF
- Multiple page formats (A4, Letter, etc.)
- Landscape/portrait orientation
- Custom margins and scaling
- Header/footer templates

Example:
```bash
chromancer pdf --output report.pdf --format A4
chromancer pdf --output doc.pdf --landscape --background
chromancer pdf --output print.pdf --margin "1in" --page-ranges "1-5"
```

### 7. **network** - Network monitoring
- Monitor all network requests and responses
- Filter by URL pattern, resource type, method, or status
- Block requests matching patterns
- Export network logs to JSON
- Real-time monitoring with statistics

Example:
```bash
chromancer network --filter "api" --type xhr
chromancer network --method POST --output api-calls.json
chromancer network --status 404 --status 500
chromancer network --block "ads" --block "analytics"
```

### 8. **wait-for-login** - Authentication helper
- Navigate to login page and wait for user to complete authentication
- Configurable ready selector to detect successful login
- Perfect for automating authenticated sessions
- Works with Chrome profiles for persistent sessions

Example:
```bash
chromancer wait-for-login https://gmail.com
chromancer wait-for-login https://github.com --ready-selector ".Header-link--profile"
chromancer wait-for-login https://app.example.com --profile work
```

## Testing

All new features include:
- Comprehensive unit tests
- Integration tests with real browser interactions
- Help text validation
- Error handling and edge cases

Run tests with:
```bash
node test/new-features.test.js
node test/integration-tests.js
```

## Benefits

These new features make chromancer a more complete browser automation tool:

1. **Testing**: Record user actions and replay them, fill forms automatically
2. **Web Scraping**: Export data in multiple formats, monitor network requests
3. **Automation**: Scroll pages, manage cookies, handle authentication
4. **Documentation**: Generate PDFs of web pages
5. **Debugging**: Monitor network traffic, block unwanted requests

All commands follow chromancer's design principles:
- Simple, intuitive CLI interface
- Composable with other commands
- Support for Chrome profiles
- Verbose logging options
- Proper error handling