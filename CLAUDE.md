# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains two main components:

1. **Claude Code** - An agentic coding CLI tool (root directory)
2. **CDP-CLI** - A Chrome DevTools Protocol CLI tool for web automation (cdp-cli subdirectory)

## Common Development Commands

### CDP-CLI Project Commands

Navigate to the `cdp-cli` directory first:

```bash
cd cdp-cli
```

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

# Complete verification
./verify-all.sh
```

**Start Chrome for testing:**
```bash
# Headless mode
google-chrome --remote-debugging-port=9222 --headless=new

# With GUI
google-chrome --remote-debugging-port=9222

# Or use Docker
docker run -d --name chrome-test -p 9222:9222 zenika/alpine-chrome \
  --no-sandbox --remote-debugging-host=0.0.0.0 --remote-debugging-port=9222
```

## Architecture Overview

### CDP-CLI Architecture

The CDP-CLI tool follows the oclif framework pattern:

1. **Base Command Class** (`src/base.ts`):
   - Handles Chrome connection logic via puppeteer-core
   - Provides shared flags (port, host, launch)
   - Manages browser lifecycle (connect/disconnect/launch)
   - Auto-detects Chrome executable paths

2. **Command Structure** (`src/commands/`):
   - Each command extends BaseCommand
   - Commands: navigate, click, type, evaluate, screenshot
   - All commands support global flags for Chrome connection
   - Commands handle their specific CDP operations

3. **Key Design Decisions**:
   - Uses puppeteer-core for CDP communication
   - Supports both connecting to existing Chrome instances and auto-launching
   - TypeScript for type safety
   - oclif framework for CLI structure and help generation

### Chrome Connection Flow

1. Commands first attempt to connect to existing Chrome instance
2. If connection fails and `--launch` flag is provided, attempts to launch Chrome
3. Automatically finds Chrome executable across different platforms
4. Properly cleans up connections (disconnect vs close based on launch mode)

## Important Notes

- The CDP-CLI tool requires Chrome/Chromium to be installed and running with remote debugging enabled
- All CDP-CLI commands are in the `cdp-cli` subdirectory
- The tool supports both manual Chrome management and auto-launch mode
- Tests include unit tests (no Chrome needed) and integration tests (Chrome required)

## Memories

- Remember what worked and what didn't