@echo off
rem FileTool launcher
rem Save this file as UTF-8 without BOM / CRLF.
rem
rem Usage:
rem   1. Drop an instruction file onto this BAT.
rem   2. Drop one or more source files onto this BAT to run BOMFIX directly.
rem
rem Instruction commands:
rem   MKDIR <dir>
rem   MOVE "<src>" "<dst>"
rem   COPY "<src>" "<dst>"
rem   COPYDIR "<src>" "<dst>"
rem   DELETE "<path>"
rem   DELETE_PERMANENT "<path>"
rem   RENAME "<oldpath>" "<newname>"
rem   BOMFIX "<path>"
rem   FIXBOM "<path>"
rem   UTF8NOBOM "<path>"
rem   UTF8_NO_BOM "<path>"

chcp 65001 >nul
setlocal EnableExtensions

set "BATCH_DIR=%~dp0"
set "PS_FILE=%BATCH_DIR%Filetool.ps1"

if "%~1"=="" (
    echo.
    echo [USAGE]
    echo   1. Drop an instruction file onto Filetool.bat.
    echo   2. Drop one or more source files onto Filetool.bat to run BOMFIX directly.
    echo.
    echo [Instruction sample]
    echo   MKDIR "G:\claudedir\test_dir"
    echo   MOVE "G:\claudedir\a.txt" "G:\claudedir\test_dir\a.txt"
    echo   BOMFIX "G:\claudedir\issue_manager\start.bat"
    echo.
    pause
    exit /b 1
)

if not exist "%PS_FILE%" (
    echo [ERROR] PowerShell script not found: %PS_FILE%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%" %*

endlocal
exit /b %ERRORLEVEL%
