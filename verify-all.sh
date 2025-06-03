#!/bin/bash

echo "Chrome DevTools Protocol CLI - Complete Verification"
echo "==================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Run all tests
echo -e "${YELLOW}Running Unit Tests...${NC}"
node test/unit-tests.js
echo ""

echo -e "${YELLOW}Running Regression Tests...${NC}"
node test/regression-tests.js
echo ""

echo -e "${YELLOW}Checking CLI Help...${NC}"
node ./bin/run.js --help
echo ""

echo -e "${YELLOW}Build Information:${NC}"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "TypeScript files compiled: $(find dist -name "*.js" | wc -l)"
echo ""

echo -e "${GREEN}✓ All verifications complete!${NC}"
echo ""
echo "To run with Chrome:"
echo "1. Start Chrome: google-chrome --remote-debugging-port=9222 --headless"
echo "2. Run commands: node ./bin/run.js navigate https://example.com"
echo ""
echo "Or use --launch flag to auto-start Chrome (if installed):"
echo "   node ./bin/run.js navigate https://example.com --launch"