@echo off
REM Clean installation - remove node_modules and lock files

echo Cleaning up...
echo.

if exist node_modules (
    echo - Removing node_modules
    rmdir /s /q node_modules
)

if exist package-lock.json (
    echo - Removing package-lock.json
    del /q package-lock.json
)

if exist frontend\node_modules (
    echo - Removing frontend\node_modules
    rmdir /s /q frontend\node_modules
)

if exist frontend\package-lock.json (
    echo - Removing frontend\package-lock.json
    del /q frontend\package-lock.json
)

echo.
echo Cleanup complete!
echo.
echo You can now run: install.bat
