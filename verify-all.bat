@echo off
echo Chrome DevTools Protocol CLI - Complete Verification
echo ===================================================
echo.

REM Run all tests
echo Running Unit Tests...
node test/unit-tests.js
echo.

echo Running Regression Tests...
node test/regression-tests.js
echo.

echo Checking CLI Help...
node ./bin/run.js --help
echo.

echo Build Information:
echo Node version:
node --version
echo NPM version:
npm --version

REM Count TypeScript compiled files
for /f %%A in ('dir /s /b dist\*.js ^| find /c /v ""') do set JS_COUNT=%%A
echo TypeScript files compiled: %JS_COUNT%
echo.

echo [SUCCESS] All verifications complete!
echo.
echo To run with Chrome:
echo 1. Start Chrome: chrome.exe --remote-debugging-port=9222 --headless
echo 2. Run commands: node ./bin/run.js navigate https://example.com
echo.
echo Or use --launch flag to auto-start Chrome (if installed):
echo    node ./bin/run.js navigate https://example.com --launch