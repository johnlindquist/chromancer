#!/bin/bash

echo "Testing interactive wait feature..."
echo ""

# Build the project first
echo "Building project..."
pnpm run build

echo ""
echo "Test 1: Simple interactive wait"
echo "================================"
node ./bin/run.js ai --no-interactive "navigate to example.com, then wait for me to inspect the page, then take a screenshot"

echo ""
echo "Test 2: Wait with custom message"
echo "================================"
node ./bin/run.js ai --no-interactive "go to github.com, wait with message 'Please sign in to your GitHub account and press Enter when ready', then navigate to settings"

echo ""
echo "✅ Tests complete!"