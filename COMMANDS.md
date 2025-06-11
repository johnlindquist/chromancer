# Chromancer Command Reference

## Complete Command List

### 🎯 Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `spawn` | Start Chrome with remote debugging | `chromancer spawn --headless` |
| `stop` | Stop the active Chrome instance | `chromancer stop` |
| `navigate` / `go` | Navigate to a URL | `chromancer navigate https://example.com` |
| `click` | Click an element | `chromancer click "button.submit"` |
| `type` | Type text into an element | `chromancer type "#email" "user@example.com"` |
| `evaluate` | Execute JavaScript | `chromancer evaluate "document.title"` |
| `screenshot` / `shot` | Take a screenshot | `chromancer screenshot page.png --full-page` |
| `select` | Find and inspect elements | `chromancer select "a[href]" --limit 10` |

### 📝 Workflow Commands

| Command | Description | Example |
|---------|-------------|---------|
| `run` | Execute YAML workflows | `chromancer run workflow.yml --var KEY=value` |
| `record` | Record browser actions | `chromancer record --output actions.json` |

### 🎮 Interactive Commands

| Command | Description | Example |
|---------|-------------|---------|
| `interactive` | Start interactive REPL | `chromancer interactive` |
| `session` | Alias for interactive | `chromancer session` |
| `repl` | Alias for interactive | `chromancer repl` |

### ⏳ Wait Commands

| Command | Description | Example |
|---------|-------------|---------|
| `wait` | Wait for elements/conditions | `chromancer wait --selector ".loaded"` |
| `wait-for-login` | Wait for user login | `chromancer wait-for-login https://app.com` |

### 📊 Data Commands

| Command | Description | Example |
|---------|-------------|---------|
| `export` | Export page content | `chromancer export --format json --selector "table"` |
| `store` | Store values for later use | `chromancer store --selector "h1" --name title` |
| `assert` | Assert conditions | `chromancer assert --selector "h1" --text "Welcome"` |

### 🖱️ Interaction Commands

| Command | Description | Example |
|---------|-------------|---------|
| `hover` | Hover over element | `chromancer hover "#menu" --wait-for ".submenu"` |
| `scroll` | Scroll the page | `chromancer scroll down` |
| `fill` | Fill form fields | `chromancer fill --auto-generate` |

### 🍪 Browser Management

| Command | Description | Example |
|---------|-------------|---------|
| `cookies` | Manage cookies | `chromancer cookies list` |
| `pdf` | Generate PDF | `chromancer pdf --output report.pdf` |
| `network` | Monitor network | `chromancer network --filter "api"` |

### 🚀 Quick Commands

| Command | Description | Example |
|---------|-------------|---------|
| `quick check` | Site health check | `chromancer quick check example.com` |
| `quick capture` | Fast screenshot | `chromancer quick capture site.com screen.png` |
| `quick extract` | Extract data | `chromancer quick extract site.com "h2"` |
| `quick test` | Comprehensive test | `chromancer quick test example.com` |

### ⚙️ Configuration

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Setup wizard | `chromancer init` |
| `config` | Manage settings | `chromancer config set chrome.port 9223` |
| `examples` | Show examples | `chromancer examples scraping` |
| `sessions` | List Chrome instances | `chromancer sessions` |

## Global Flags

Available for most commands:

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port` | Chrome debugging port | 9222 |
| `-h, --host` | Chrome debugging host | localhost |
| `-l, --launch` | Launch Chrome if not running | false |
| `--profile` | Chrome profile to use | - |
| `--headless` | Run in headless mode | false |
| `-v, --verbose` | Verbose logging | false |
| `-k, --keep-open` | Keep Chrome open after command | true |

## Command-Specific Options

### navigate
- `--wait-until` - Wait condition: `load`, `domcontentloaded`, `networkidle`
- `--timeout` - Navigation timeout in ms

### click
- `--wait-for-navigation` - Wait for navigation after click
- `--button` - Mouse button: `left`, `right`, `middle`
- `--click-count` - Number of clicks
- `--position` - Click position: `x,y`
- `--force` - Force click even if element is not visible

### type
- `--clear-first` - Clear field before typing
- `--delay` - Delay between keystrokes in ms
- `--press-enter` - Press Enter after typing
- `--press-tab` - Press Tab after typing

### screenshot
- `--full-page` - Capture full page
- `--selector` - Capture specific element
- `--type` - Image format: `png`, `jpeg`, `webp`
- `--quality` - JPEG quality (0-100)
- `--omit-background` - Transparent background

### wait
- `--selector` - CSS selector to wait for
- `--text` - Text to wait for
- `--url` - URL pattern to wait for
- `--condition` - JavaScript condition
- `--timeout` - Maximum wait time in ms
- `--state` - Element state: `visible`, `hidden`, `attached`, `detached`

### export
- `--format` - Export format: `html`, `json`, `csv`, `markdown`, `text`
- `--selector` - Element to export
- `--output` - Output file path
- `--all-resources` - Export all page resources
- `--include-styles` - Include computed styles

### fill
- `--data` - JSON data for form fields
- `--file` - JSON file with form data
- `--auto-generate` - Generate test data
- `--submit` - Submit form after filling
- `--wait-after` - Wait time between fields

### pdf
- `--format` - Page format: `A4`, `Letter`, `Legal`, etc.
- `--landscape` - Use landscape orientation
- `--scale` - Scale percentage
- `--margin` - Page margins
- `--background` - Print background graphics
- `--page-ranges` - Pages to print

### network
- `--filter` - URL filter pattern
- `--type` - Resource type filter
- `--method` - HTTP method filter
- `--status` - Status code filter
- `--block` - Block matching requests
- `--duration` - Monitoring duration
- `--output` - Output file for logs

### run (workflows)
- `--var` - Set workflow variables
- `--strict` - Stop on first error
- `--continue-on-error` - Continue despite errors
- `--dry-run` - Validate without executing
- `--timeout` - Default command timeout

## Workflow Commands

Available in YAML workflows:

```yaml
- navigate: <url>
- click: <selector>
- type:
    selector: <selector>
    text: <text>
- wait:
    selector: <selector>
    timeout: <ms>
- screenshot: <filename>
- evaluate: <javascript>
- select:
    selector: <selector>
    value: <value>
- hover: <selector>
- scroll: <direction>
- fill:
    form:
      field1: value1
      field2: value2
- press: <key>
- reload:
- back:
- forward:
```

## Examples by Use Case

### Web Scraping
```bash
# Extract all links
chromancer evaluate "Array.from(document.querySelectorAll('a')).map(a => ({text: a.textContent, href: a.href}))"

# Export table as CSV
chromancer export --format csv --selector "table" --output data.csv

# Save complete page
chromancer export --format html --all-resources --output-dir ./site-backup
```

### Testing
```bash
# Visual regression
chromancer screenshot baseline.png
# ... make changes ...
chromancer screenshot current.png
diff baseline.png current.png

# Performance test
chromancer evaluate "performance.timing" --json > perf.json

# Accessibility check
chromancer quick test example.com
```

### Authentication
```bash
# Manual login
chromancer spawn --profile work
chromancer wait-for-login https://app.com

# Automated login
chromancer run login.yml --var USER=me --var PASS=secret
```

### Monitoring
```bash
# Watch for changes
chromancer navigate https://status.page.com
chromancer wait --text "All Systems Operational" --timeout 60000

# Monitor API calls
chromancer network --filter "/api/" --duration 30000 --output api-log.json
```