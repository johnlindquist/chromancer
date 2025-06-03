#!/bin/bash

echo "Chrome DevTools Protocol CLI Test Script"
echo "========================================"
echo ""
echo "Before running this script, make sure Chrome is running with:"
echo "google-chrome --remote-debugging-port=9222 --headless=new"
echo ""
echo "Press Enter to continue..."
read

# Test navigate command
echo "1. Testing navigate command..."
node ./bin/run.js navigate https://example.com
echo ""

# Test screenshot command
echo "2. Testing screenshot command..."
node ./bin/run.js screenshot example-screenshot.png
echo ""

# Test evaluate command
echo "3. Testing evaluate command (get page title)..."
node ./bin/run.js evaluate "document.title"
echo ""

# Test evaluate command (count links)
echo "4. Testing evaluate command (count links)..."
node ./bin/run.js evaluate "document.querySelectorAll('a').length"
echo ""

# Test click command
echo "5. Testing click command (will try to click first link)..."
node ./bin/run.js click "a" || echo "No clickable links found"
echo ""

# Test type command
echo "6. Testing type command (if there's an input field)..."
node ./bin/run.js type "input" "test text" || echo "No input fields found"
echo ""

echo "Test completed!"