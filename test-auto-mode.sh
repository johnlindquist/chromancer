#!/bin/bash

echo "Testing AI auto mode functionality..."
echo ""

# Test 1: Auto mode with a workflow that will likely fail first time
echo "Test 1: Auto mode with complex task"
echo "Running: chromancer ai \"Navigate to example.com and find the contact email\" --auto --no-interactive"
node ./bin/run.js ai "Navigate to example.com and find the contact email" --auto --no-interactive || true

echo ""
echo "----------------------------------------"
echo ""

# Test 2: Normal mode to see AI recommendations
echo "Test 2: Normal mode with AI recommendations"
echo "Running: chromancer ai \"Navigate to invalid-selector-test.com and click button.does-not-exist\" --no-auto"
node ./bin/run.js ai "Navigate to invalid-selector-test.com and click button.does-not-exist" --no-auto --no-interactive || true

echo ""
echo "Test complete!"