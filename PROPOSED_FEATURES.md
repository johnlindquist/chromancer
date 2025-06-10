# Proposed Chromancer Features

Based on comprehensive edge case testing, here are proposed new commands and features to enhance Chromancer's capabilities:

## 1. New Commands

### `chromancer wait`
Wait for specific conditions before proceeding.
```bash
# Wait for element to appear
chromancer wait --selector "#dynamic-content"

# Wait for element to be visible
chromancer wait --selector "#loading" --visible

# Wait for custom condition
chromancer wait --condition "document.readyState === 'complete'"

# Wait with timeout
chromancer wait --selector ".ajax-result" --timeout 5000
```

### `chromancer hover`
Trigger hover states and mouse-over events.
```bash
# Hover over element
chromancer hover "#menu-item"

# Hover and wait
chromancer hover ".tooltip-trigger" --duration 1000
```

### `chromancer double-click`
Native double-click support.
```bash
chromancer double-click "#editable-cell"
```

### `chromancer right-click`
Context menu interaction.
```bash
chromancer right-click "#context-target"
```

### `chromancer drag`
Drag and drop operations.
```bash
# Drag from source to target
chromancer drag "#draggable" --to "#drop-zone"

# Drag by offset
chromancer drag "#slider-handle" --offset "100,0"
```

### `chromancer back` / `chromancer forward`
Browser navigation controls.
```bash
chromancer back
chromancer forward
chromancer refresh
```

### `chromancer store`
Store values for later use (selector caching).
```bash
# Store element text
chromancer store --selector "#price" --as "originalPrice"

# Store evaluation result
chromancer store --eval "document.title" --as "pageTitle"

# Use stored values
chromancer evaluate "localStorage.getItem('${originalPrice}')"
```

### `chromancer assert`
Built-in assertions for testing.
```bash
# Assert element exists
chromancer assert --selector "#success-message"

# Assert text content
chromancer assert --selector "h1" --contains "Welcome"

# Assert value
chromancer assert --selector "#total" --equals "100"

# Assert evaluation
chromancer assert --eval "window.location.pathname" --equals "/checkout"
```

### `chromancer fill-form`
Intelligent form filling.
```bash
# Auto-detect and fill form fields
chromancer fill-form --data '{"name": "John", "email": "john@example.com"}'

# Fill specific form
chromancer fill-form --selector "#checkout-form" --data form.json
```

### `chromancer workflow`
Execute saved workflow files.
```bash
# Run workflow from file
chromancer workflow checkout.yaml

# Example workflow file:
# - navigate: https://shop.example.com
# - click: .product:first
# - click: #add-to-cart
# - navigate: /checkout
# - fill-form:
#     data:
#       email: test@example.com
# - click: #place-order
```

## 2. Command Chaining

### Pipe-based Chaining
Allow commands to be piped together:
```bash
# Navigate, wait, then click
chromancer navigate https://example.com | \
chromancer wait --selector "#cookie-banner" | \
chromancer click "#accept-cookies"

# Complex workflow
chromancer navigate https://shop.com | \
chromancer type "#search" "laptop" | \
chromancer click "#search-button" | \
chromancer wait --selector ".results" | \
chromancer click ".product:first" | \
chromancer screenshot product.png
```

### `--then` Flag
Chain commands within a single call:
```bash
chromancer navigate https://example.com \
  --then click "#login" \
  --then type "#username" "user@example.com" \
  --then type "#password" "pass123" \
  --then click "#submit"
```

### Script Mode
Execute multiple commands from a script:
```bash
# chromancer-script.sh
chromancer script <<EOF
navigate https://example.com
wait --selector "#content"
click "#start-demo"
type "#email" "demo@example.com"
click "#submit"
wait --selector "#success"
screenshot demo-complete.png
EOF
```

## 3. Enhanced Selectors

### Pseudo-selectors
```bash
# Click element containing text
chromancer click ":contains('Add to Cart')"

# Click visible element only
chromancer click ".button:visible"

# Click by index
chromancer click ".item:nth(2)"
```

### XPath Support
```bash
chromancer click --xpath "//button[contains(text(), 'Submit')]"
```

### Multiple Selector Strategies
```bash
# Try multiple selectors until one works
chromancer click --any "#submit-btn, button[type=submit], .submit"
```

## 4. Enhanced Features

### Parallel Execution
```bash
# Run commands in parallel windows/tabs
chromancer parallel <<EOF
window1: navigate https://example.com/page1
window2: navigate https://example.com/page2
EOF
```

### Conditional Logic
```bash
# If element exists, click it
chromancer if --selector "#popup" --then click "#close-popup"

# If condition is true, execute command
chromancer if --eval "document.cookie.includes('logged_in')" \
  --then navigate "/dashboard" \
  --else navigate "/login"
```

### Loops
```bash
# Click all matching elements
chromancer foreach ".item" click

# Repeat action
chromancer repeat 5 click "#load-more"
```

### Variables and Templates
```bash
# Set variables
chromancer set baseUrl "https://example.com"
chromancer set username "testuser"

# Use variables
chromancer navigate "${baseUrl}/login"
chromancer type "#username" "${username}"
```

## 5. Better Error Handling

### Retry Mechanism
```bash
# Retry failed commands
chromancer click "#dynamic-button" --retry 3 --retry-delay 1000
```

### Soft Failures
```bash
# Continue on error
chromancer click "#optional-popup-close" --continue-on-error
```

### Error Context
```bash
# Save screenshot on error
chromancer click "#button" --on-error screenshot error.png
```

## 6. Session Management

### Save/Restore State
```bash
# Save current state
chromancer session save --name "logged-in"

# Restore state
chromancer session restore --name "logged-in"

# List sessions
chromancer session list
```

### Cookie Management
```bash
# Save cookies
chromancer cookies save --file cookies.json

# Load cookies
chromancer cookies load --file cookies.json

# Clear cookies
chromancer cookies clear --domain example.com
```

## 7. Advanced Interactions

### Keyboard Shortcuts
```bash
# Send keyboard shortcuts
chromancer keyboard "Ctrl+A"
chromancer keyboard "Cmd+S"
chromancer keyboard "Escape"
```

### Mouse Actions
```bash
# Mouse movement
chromancer mouse move --to "#target"
chromancer mouse move --by "100,100"

# Mouse wheel
chromancer scroll --by "0,500"
chromancer scroll --to "#section"
```

### Focus Management
```bash
# Focus element
chromancer focus "#input"

# Tab through elements
chromancer keyboard "Tab"
```

## Implementation Priority

### High Priority (Gap Fillers)
1. `wait` - Critical for dynamic content
2. `hover` - Common interaction pattern
3. `store` - Enable complex workflows
4. Command chaining - Improve workflow efficiency
5. `assert` - Built-in testing capability

### Medium Priority (Enhancements)
1. `double-click` / `right-click` - Extended interactions
2. `back` / `forward` - Navigation control
3. `fill-form` - Common use case optimization
4. Better selectors - Improved element targeting
5. Retry mechanism - Reliability

### Low Priority (Advanced)
1. `workflow` files - Complex automation
2. Parallel execution - Advanced use cases
3. Conditional logic - Programming constructs
4. Session management - Stateful operations

## Conclusion

These proposed features address the gaps identified during edge case testing:
- **Dynamic content handling** (wait, retry)
- **Complex interactions** (hover, drag, keyboard)
- **Workflow automation** (chaining, scripts, workflows)
- **Reliability** (better selectors, error handling)
- **Testing capabilities** (assertions, conditionals)

The command chaining mechanism would be particularly powerful, allowing users to create complex automation flows without writing full programs.