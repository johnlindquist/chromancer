#!/bin/bash

echo "Testing All Prompts After Readline Cleanup"
echo "=========================================="
echo ""

# Test 1: Config reset command
echo "Test 1: Config reset command (should show inquirer confirm prompt)"
echo "node ./bin/run.js config reset"
echo "Expected: Inquirer confirm prompt asking if you want to reset"
echo "Press Ctrl+C to skip this test"
echo ""
read -p "Press Enter to run test 1..."
node ./bin/run.js config reset

echo ""
echo "---"
echo ""

# Test 2: Workflow executor wait command
echo "Test 2: Testing workflow with interactive wait"
cat > test-wait-workflow.yaml << 'EOF'
- navigate: https://example.com
- wait: 
    message: "This is a test pause. Press Enter to continue"
- screenshot: test-wait-screenshot.png
EOF

echo "node ./bin/run.js run test-wait-workflow.yaml"
echo "Expected: Should navigate, show inquirer input prompt, then take screenshot"
echo "Press Ctrl+C to skip this test"
echo ""
read -p "Press Enter to run test 2..."
node ./bin/run.js run test-wait-workflow.yaml

echo ""
echo "---"
echo ""

# Test 3: AI command with failure
echo "Test 3: AI command that will show menu (arrow keys should work)"
echo "node ./bin/run.js ai 'Click on a button that does not exist .nonexistent-xyz'"
echo "Expected: Workflow will fail, then show menu where arrow keys work"
echo "Test the arrow keys Up/Down to navigate the menu"
echo "Press Ctrl+C to skip this test"
echo ""
read -p "Press Enter to run test 3..."
node ./bin/run.js ai "Click on a button that does not exist .nonexistent-xyz"

echo ""
echo "---"
echo ""

# Test 4: Workflows management
echo "Test 4: Workflows list command (if you have saved workflows)"
echo "node ./bin/run.js workflows list"
echo "Expected: Should list workflows and allow selection with arrow keys"
echo "Press Ctrl+C to skip this test"
echo ""
read -p "Press Enter to run test 4..."
node ./bin/run.js workflows list

echo ""
echo "All tests completed!"
echo ""
echo "Summary of changes:"
echo "- Replaced readline with @inquirer/prompts in workflow-executor.ts"
echo "- Replaced process.stdin listener with @inquirer/prompts in config.ts"
echo "- Simplified stabilizeTerminal() to let Inquirer handle terminal state"
echo "- Kept readline for interactive REPL commands (correct usage)"

# Cleanup
rm -f test-wait-workflow.yaml test-wait-screenshot.png