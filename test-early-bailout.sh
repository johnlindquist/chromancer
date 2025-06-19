#!/bin/bash

echo "Testing early bailout functionality..."
echo ""

# Test 1: With early bailout enabled (default)
echo "Test 1: Early bailout ENABLED (default)"
echo "Running: chromancer ai \"Navigate to invalid.url.test, click button, type hello\""
node ./bin/run.js ai "Navigate to invalid.url.test, click button, type hello" --no-interactive || true

echo ""
echo "----------------------------------------"
echo ""

# Test 2: With early bailout disabled
echo "Test 2: Early bailout DISABLED"
echo "Running: chromancer ai \"Navigate to invalid.url.test, click button, type hello\" --no-early-bailout"
node ./bin/run.js ai "Navigate to invalid.url.test, click button, type hello" --no-early-bailout --no-interactive || true

echo ""
echo "Test complete!"