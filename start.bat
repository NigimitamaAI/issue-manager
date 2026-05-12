@echo off
rem 日本語対応: このbatは UTF-8 BOMなし で保存してください
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem issue_manager launcher - browser forced/open-any-response version
rem - UTF-8 without BOM
rem - Debug log enabled
rem - Does not require /api/ping to contain a specific JSON string
rem - Opens browser when either / or /api/ping responds
rem ============================================================

set "SCRIPT_DIR=%~dp0"
set "CONFIG_FILE=%SCRIPT_DIR%config.json"
set "SERVER_FILE=%SCRIPT_DIR%core\server.mjs"
set "LOG_DIR=%SCRIPT_DIR%logs"
set "LOG_FILE="

set "PORT=5180"
set "NODE_EXE=node"

rem ------------------------------------------------------------
rem Read config.json when available
rem ------------------------------------------------------------
if exist "%CONFIG_FILE%" (
    echo [INFO] Reading config.json...
    for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; try { $cfg='%CONFIG_FILE%'; $scriptDir='%SCRIPT_DIR%'; $c = Get-Content -Raw -Encoding UTF8 -LiteralPath $cfg | ConvertFrom-Json; $p = if ($c.port) { [int]$c.port } else { 5180 }; $n = if ($c.nodeExe) { [string]$c.nodeExe } else { 'node' }; $l = if ($c.logDir) { [string]$c.logDir } else { 'logs' }; $l = $l -replace '/', '\'; if (-not [System.IO.Path]::IsPathRooted($l)) { $l = Join-Path $scriptDir $l }; Write-Output ($p.ToString() + '|' + $n + '|' + $l) } catch { Write-Output '5180|node|%SCRIPT_DIR%logs' }"`) do (
        set "_CFG_LINE=%%V"
    )
    if defined _CFG_LINE (
        for /f "tokens=1,2,* delims=|" %%A in ("!_CFG_LINE!") do (
            if not "%%A"=="" set "PORT=%%A"
            if not "%%B"=="" set "NODE_EXE=%%B"
            if not "%%C"=="" set "LOG_DIR=%%C"
        )
    )
) else (
    echo [INFO] config.json not found. Using defaults.
)

rem Normalize config values. If nodeExe was written as ""E:/.../node.exe"",
rem wrapping it again would become ""E:" and cmd would fail.
set "NODE_EXE=%NODE_EXE:"=%"
set "LOG_DIR=%LOG_DIR:"=%"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "LOG_FILE=%LOG_DIR%\start_debug.log"

> "%LOG_FILE%" echo ============================================================
>> "%LOG_FILE%" echo issue_manager start debug log
>> "%LOG_FILE%" echo DATE: %DATE% %TIME%
>> "%LOG_FILE%" echo SCRIPT_DIR: %SCRIPT_DIR%
>> "%LOG_FILE%" echo CONFIG_FILE: %CONFIG_FILE%
>> "%LOG_FILE%" echo SERVER_FILE: %SERVER_FILE%
>> "%LOG_FILE%" echo LOG_DIR: %LOG_DIR%
>> "%LOG_FILE%" echo ============================================================

echo [INFO] Debug log: %LOG_FILE%
if exist "%CONFIG_FILE%" (>> "%LOG_FILE%" echo Reading config.json: %CONFIG_FILE%) else (>> "%LOG_FILE%" echo config.json not found. Using defaults.)

set "URL=http://127.0.0.1:%PORT%/"
set "PING=http://127.0.0.1:%PORT%/api/ping"

>> "%LOG_FILE%" echo PORT: %PORT%
>> "%LOG_FILE%" echo NODE_EXE: %NODE_EXE%
>> "%LOG_FILE%" echo URL: %URL%
>> "%LOG_FILE%" echo PING: %PING%

echo [INFO] PORT=%PORT%  NODE_EXE=%NODE_EXE%
echo [INFO] URL=%URL%

rem ------------------------------------------------------------
rem Verify Node.js
rem ------------------------------------------------------------
echo [INFO] Checking Node.js...
"%NODE_EXE%" -v >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js could not be executed: %NODE_EXE%
    echo Please install Node.js or fix nodeExe in config.json.
    echo.
    >> "%LOG_FILE%" echo Node execution failed.
    pause
    exit /b 1
)

if not exist "%SERVER_FILE%" (
    echo.
    echo [ERROR] server.mjs was not found.
    echo Expected: %SERVER_FILE%
    echo.
    >> "%LOG_FILE%" echo server.mjs not found.
    pause
    exit /b 1
)

rem ------------------------------------------------------------
rem If the app already responds, just open it.
rem ------------------------------------------------------------
echo [INFO] Checking existing server...
call :check_http
>> "%LOG_FILE%" echo Initial HTTP_RESULT=%HTTP_RESULT%
if "%HTTP_RESULT%"=="UP" goto :open_browser

rem ------------------------------------------------------------
rem Start server in a visible console window.
rem ------------------------------------------------------------
echo [INFO] Starting server window...
set "RUNNER_CMD=%LOG_DIR%\run_issue_manager_server.cmd"
> "%RUNNER_CMD%" echo @echo off
>> "%RUNNER_CMD%" echo chcp 65001 ^>nul
>> "%RUNNER_CMD%" echo echo [issue_manager server]
>> "%RUNNER_CMD%" echo echo SCRIPT_DIR: %SCRIPT_DIR%
>> "%RUNNER_CMD%" echo echo NODE_EXE: %NODE_EXE%
>> "%RUNNER_CMD%" echo echo SERVER_FILE: %SERVER_FILE%
>> "%RUNNER_CMD%" echo echo CONFIG_FILE: %CONFIG_FILE%
>> "%RUNNER_CMD%" echo echo.
>> "%RUNNER_CMD%" echo cd /d "%SCRIPT_DIR%"
>> "%RUNNER_CMD%" echo call "%NODE_EXE%" "%SERVER_FILE%" --config "%CONFIG_FILE%"
>> "%RUNNER_CMD%" echo echo.
>> "%RUNNER_CMD%" echo echo [server exited] errorlevel=%%ERRORLEVEL%%
>> "%RUNNER_CMD%" echo pause
>> "%LOG_FILE%" echo Starting via runner: %RUNNER_CMD%
>> "%LOG_FILE%" echo Runner command: call "%NODE_EXE%" "%SERVER_FILE%" --config "%CONFIG_FILE%"
start "issue_manager server" "%RUNNER_CMD%"

set /a WAIT_COUNT=0
:wait_loop
set /a WAIT_COUNT+=1
timeout /t 1 /nobreak >nul
call :check_http
>> "%LOG_FILE%" echo WAIT %WAIT_COUNT% HTTP_RESULT=%HTTP_RESULT%
if "%HTTP_RESULT%"=="UP" goto :open_browser

if %WAIT_COUNT% GEQ 12 (
    echo.
    echo [WARN] The app did not respond within 12 seconds.
    echo        I will still try to open the browser.
    echo        If the page is blank, check the server window and this log:
    echo        %LOG_FILE%
    echo.
    >> "%LOG_FILE%" echo Timeout reached. Opening browser anyway.
    goto :open_browser
)

goto :wait_loop

:open_browser
echo.
echo [OK] Opening browser: %URL%
>> "%LOG_FILE%" echo Opening browser: %URL%

rem Most reliable method on Windows when file association is normal
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%URL%'" >> "%LOG_FILE%" 2>&1
if not errorlevel 1 goto :done

rem Fallback 1
start "" "%URL%"
if not errorlevel 1 goto :done

rem Fallback 2
start "" explorer.exe "%URL%"

:done
echo.
echo [INFO] If the browser did not open, manually open:
echo        %URL%
echo.
echo [INFO] Log file:
echo        %LOG_FILE%
echo.
endlocal
exit /b 0

:check_http
set "HTTP_RESULT=DOWN"
for /f "usebackq delims=" %%R in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $u1='%URL%'; $u2='%PING%'; try { Invoke-WebRequest -Uri $u1 -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop ^| Out-Null; 'UP'; exit 0 } catch { Invoke-WebRequest -Uri $u2 -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop ^| Out-Null; 'UP'; exit 0 } } catch { 'DOWN' }"`) do (
    set "HTTP_RESULT=%%R"
)
exit /b 0
