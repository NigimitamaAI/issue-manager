@echo off
chcp 65001 >nul
setlocal

rem issue_manager Setup Launcher
rem Calls install.ps1 with execution policy bypass for one-time use.
rem install.ps1 generates config.json interactively (no setx, no env vars).

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%install.ps1"

if not exist "%PS_SCRIPT%" (
    echo [ERROR] install.ps1 not found at: %PS_SCRIPT%
    pause
    exit /b 1
)

rem Use -NoProfile to avoid loading user profile (faster, fewer side effects)
rem Use -ExecutionPolicy Bypass to allow running without policy change
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

if errorlevel 1 (
    echo.
    echo [ERROR] Setup script exited with error code %errorlevel%
    pause
    exit /b %errorlevel%
)

endlocal
