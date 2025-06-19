#!/bin/bash

echo "Testing the three fixes..."
echo ""

# Build the project first
echo "Building project..."
pnpm run build

echo ""
echo "=== Test 1: Duplicate workflow save prompt ==="
echo "This test requires manual interaction:"
echo "1. Run an AI workflow that succeeds"
echo "2. Select 'Save workflow for future use'"
echo "3. Verify you are NOT asked 'Would you like to save this workflow?'"
echo "4. Instead, you should go directly to entering name/description/tags"
echo ""
echo "Press Enter to continue..."
read

echo ""
echo "=== Test 2: Session termination ==="
echo "This test requires manual interaction:"
echo "1. Run an AI workflow that succeeds"
echo "2. Select 'Done' or save the workflow"
echo "3. Verify the process exits cleanly (no hanging)"
echo ""
echo "Press Enter to continue..."
read

echo ""
echo "=== Test 3: Input sync issues ==="
echo "Testing type command with clear and delays..."
echo ""

# Navigate to a page with input
node ./bin/run.js navigate https://www.google.com

# Type with clear-first flag (should have proper delays)
echo "Typing with clear-first..."
node ./bin/run.js type 'input[name="q"]' "Test input" --clear-first

# Wait a bit
sleep 1

# Use keypress to delete some characters
echo "Deleting characters with Backspace..."
node ./bin/run.js keypress Backspace --repeat 5 --selector 'input[name="q"]'

# Type more text
echo "Typing additional text..."
node ./bin/run.js type 'input[name="q"]' " sync test"

echo ""
echo "All tests completed!"
echo "Please verify that:"
echo "1. Workflow save doesn't show duplicate prompts"
echo "2. Sessions terminate properly after completion"
echo "3. Typing/deleting works smoothly without sync issues"