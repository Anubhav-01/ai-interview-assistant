@echo off
REM ============================================================
REM  AI Interview Assistant - one-click local start (Windows)
REM  First run: installs dependencies and builds the app.
REM ============================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Download it from https://nodejs.org ^(LTS^) and run this again.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies - this happens only once...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check your internet connection and retry.
        pause
        exit /b 1
    )
)

if not exist dist\main\main.js (
    echo Building the application...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
)

echo Starting AI Interview Assistant...
call npx electron .
