# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

**Build the project:**
```bash
pnpm run build
```

**Run commands (after building):**
```bash
node ./bin/run.js [command] [options]
```

**Testing:**
```bash
# Unit tests - verify CLI structure
node test/unit-tests.js

# Regression tests
node test/regression-tests.js

# Full test suite (requires Chrome running)
node test/test-suite.js

# Vitest integration tests (comprehensive)
npm run test:vitest:run

# Run all tests with Chrome auto-start
./run-chromancer-tests.sh

# Complete verification
./verify-all.sh
```

**Start Chrome for testing:**
```bash
# Use the spawn command (recommended)
chromancer spawn --headless
chromancer spawn https://example.com

# Or use Docker
docker run -d --name chrome-test -p 9222:9222 zenika/alpine-chrome \
  --no-sandbox --remote-debugging-host=0.0.0.0 --remote-debugging-port=9222
```

## Architecture Overview

### Chromancer Architecture

The Chromancer tool follows the oclif framework pattern:

1. **Base Command Class** (`src/base.ts`):
   - Handles Chrome connection logic via Playwright
   - Provides shared flags (port, host, launch, profile)
   - Manages browser lifecycle (connect/disconnect/launch)
   - Auto-detects Chrome executable paths
   - Supports Chrome profiles for persistent sessions

2. **Command Structure** (`src/commands/`):
   - Each command extends BaseCommand
   - Core commands: navigate, click, type, evaluate, screenshot, and many more
   - All commands support global flags for Chrome connection
   - Commands handle their specific browser automation operations

3. **Key Design Decisions**:
   - Uses Playwright for robust browser automation
   - Supports both connecting to existing Chrome instances and auto-launching
   - TypeScript for type safety
   - oclif framework for CLI structure and help generation
   - YAML workflow support for complex automation scripts

### Chrome Connection Flow

1. Commands first attempt to connect to existing Chrome instance
2. If connection fails and `--launch` flag is provided, attempts to launch Chrome
3. Automatically finds Chrome executable across different platforms
4. Properly cleans up connections (disconnect vs close based on launch mode)

## Important Notes

- Chromancer requires Chrome/Chromium to be installed
- The tool supports both manual Chrome management and auto-launch mode
- Tests include unit tests (no Chrome needed) and integration tests (Chrome required)
- Built with Playwright for reliable browser automation
- Supports YAML workflows for complex automation scenarios

## Memories

- Remember what worked and what didn't
- Design workflows with command invocations that present lists of options and use prompts to improve user experience