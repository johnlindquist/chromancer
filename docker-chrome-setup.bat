@echo off
echo Chrome DevTools Protocol CLI - Docker Chrome Setup
echo ==================================================
echo.
echo This script provides commands to run Chrome in Docker for testing the CLI.
echo.

echo Option 1: Run Chrome in a separate Docker container
echo docker run -d ^
echo   --name chrome-headless ^
echo   -p 9222:9222 ^
echo   --shm-size=2g ^
echo   zenika/alpine-chrome ^
echo   --no-sandbox ^
echo   --remote-debugging-host=0.0.0.0 ^
echo   --remote-debugging-port=9222 ^
echo   --headless
echo.

echo Option 2: Use local Chrome installation
echo chrome.exe --remote-debugging-port=9222 --headless=new
echo.

echo To test if Chrome is accessible:
echo curl http://localhost:9222/json/version
echo.

echo To stop the Chrome container:
echo docker stop chrome-headless ^&^& docker rm chrome-headless