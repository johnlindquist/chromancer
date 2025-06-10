#!/bin/bash

echo "🧪 Chromancer Test Suite Runner"
echo "================================"
echo ""

# Check if Chrome is available
if ! command -v chromium &> /dev/null && ! command -v google-chrome &> /dev/null && ! command -v chrome &> /dev/null; then
    echo "⚠️  Chrome/Chromium not found!"
    echo ""
    echo "Please install Chrome or Chromium first:"
    echo "  - macOS: brew install --cask google-chrome"
    echo "  - Ubuntu: sudo apt-get install chromium-browser"
    echo "  - Or use Docker: docker run -d -p 9222:9222 zenika/alpine-chrome --no-sandbox --remote-debugging-host=0.0.0.0 --remote-debugging-port=9222"
    echo ""
    exit 1
fi

# Build the project
echo "📦 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "✅ Build successful!"
echo ""

# Check if Chrome is already running on port 9222
if lsof -Pi :9222 -sTCP:LISTEN -t >/dev/null ; then
    echo "🌐 Chrome already running on port 9222"
else
    echo "🚀 Starting Chrome with remote debugging..."
    node ./bin/run.js spawn --headless &
    CHROME_PID=$!
    echo "Chrome PID: $CHROME_PID"
    
    # Wait for Chrome to start
    echo "⏳ Waiting for Chrome to be ready..."
    sleep 3
fi

echo ""
echo "🧪 Running Vitest tests..."
echo ""

# Run the tests
npx vitest run

TEST_EXIT_CODE=$?

# Kill Chrome if we started it
if [ ! -z "$CHROME_PID" ]; then
    echo ""
    echo "🛑 Stopping Chrome..."
    kill $CHROME_PID 2>/dev/null
fi

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed!"
fi

exit $TEST_EXIT_CODE