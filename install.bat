@echo off
REM English Reading Helper - Pure Node.js Desktop App Installation Script

echo ========================================
echo English Reading Helper - Pure Node.js Setup
echo ========================================
echo.

REM Check Node.js
echo Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed.
    echo Please download and install Node.js from: https://nodejs.org/
    exit /b 1
)
echo Node.js found:
node --version
echo.

REM Step 0: Initialize server dependencies
echo [0/4] Initializing server dependencies...
node init-server.js
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to initialize server dependencies
    echo.
    echo Try: clean.bat then install.bat
    exit /b 1
)
echo Server dependencies initialized successfully.
echo.

REM Step 1: Install Node.js dependencies
echo [1/4] Installing Node.js dependencies...
call npm install --no-optional --no-save-optional
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install Node.js dependencies
    echo.
    echo Try: clean.bat then install.bat
    exit /b 1
)
echo Node.js dependencies installed successfully.
echo.

REM Step 2: Install frontend dependencies
echo [2/4] Installing frontend dependencies...
cd frontend
call npm install --no-optional --no-save-optional
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install frontend dependencies
    cd ..
    exit /b 1
)
echo Frontend dependencies installed successfully.
cd ..
echo.

REM Step 3: Build frontend
echo [3/4] Building frontend...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build frontend
    cd ..
    exit /b 1
)
cd ..
echo Frontend built successfully.
echo.

echo ========================================
echo Setup complete!
echo ========================================
echo.
echo To run the application:
echo   npm start
echo.
echo To build distribution package:
echo   npm run build-win
echo.
echo ========================================
