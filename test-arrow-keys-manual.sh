#!/bin/bash

echo "Manual Arrow Key Test for Chromancer AI Command"
echo "================================================"
echo ""
echo "This script will run the AI command and intentionally fail,"
echo "then you can test if arrow keys work in the menu."
echo ""
echo "Instructions:"
echo "1. Wait for the workflow to execute and fail"
echo "2. When you see the menu, try using UP/DOWN arrow keys"
echo "3. The selection should move between options"
echo "4. Press Enter to select an option"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Run with debug flag to see terminal state
node ./bin/run.js ai --debug "Click on a button that doesn't exist with class .nonexistent-button-xyz"