#!/bin/bash

echo "Chrome DevTools Protocol CLI - Docker Chrome Setup"
echo "=================================================="
echo ""
echo "This script provides commands to run Chrome in Docker for testing the CLI."
echo ""

cat << 'EOF'
# Option 1: Run Chrome in a separate Docker container
docker run -d \
  --name chrome-headless \
  -p 9222:9222 \
  --shm-size=2g \
  zenika/alpine-chrome \
  --no-sandbox \
  --remote-debugging-host=0.0.0.0 \
  --remote-debugging-port=9222 \
  --headless

# Option 2: Use Puppeteer's bundled Chromium (if available)
# Modify the base.ts to use:
# this.browser = await puppeteer.launch({
#   headless: 'new',
#   args: ['--no-sandbox', '--disable-setuid-sandbox']
# });

# Option 3: Install Chromium in current container (requires root)
# apt-get update && apt-get install -y chromium
# chromium --no-sandbox --headless --remote-debugging-port=9222

# To test if Chrome is accessible:
curl http://localhost:9222/json/version

# To stop the Chrome container:
docker stop chrome-headless && docker rm chrome-headless
EOF