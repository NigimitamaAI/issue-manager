# issue_manager Setup Script (config.json generator)
#
# Usage:
#   Double-click install.bat (recommended)
#   Or in PowerShell: powershell -ExecutionPolicy Bypass -File install.ps1
#
# What this does:
#   - Asks the user for: project root directory, port, optional Node.js path,
#     optional BOM fixer path, optional log directory
#   - Writes the answers into config.json next to this script
#   - DOES NOT touch OS environment variables (no setx). Each instance is
#     fully configured by its own config.json, so you can run multiple
#     issue_manager instances on the same PC by giving each one a different port.
#
# Note: All messages are in English to avoid encoding issues on Windows
# PowerShell 5.x which reads .ps1 files as CP932 by default.

# Force UTF-8 console output
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Load Windows Forms for folder/file dialogs
Add-Type -AssemblyName System.Windows.Forms

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "=== $Text ===" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Text)
    Write-Host "[INFO] $Text" -ForegroundColor Gray
}

function Write-Ok {
    param([string]$Text)
    Write-Host "[OK]   $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "[WARN] $Text" -ForegroundColor Yellow
}

function Write-Skip {
    param([string]$Text)
    Write-Host "[SKIP] $Text" -ForegroundColor DarkGray
}

# Folder selection dialog
function Select-Folder {
    param(
        [string]$Description,
        [string]$InitialPath = ""
    )
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = $Description
    $dialog.ShowNewFolderButton = $true
    if ($InitialPath -and (Test-Path $InitialPath)) {
        $dialog.SelectedPath = $InitialPath
    }
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.SelectedPath
    }
    return $null
}

# File selection dialog
function Select-File {
    param(
        [string]$Title,
        [string]$Filter = "All files (*.*)|*.*",
        [string]$InitialDir = ""
    )
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = $Title
    $dialog.Filter = $Filter
    $dialog.CheckFileExists = $true
    if ($InitialDir -and (Test-Path $InitialDir)) {
        $dialog.InitialDirectory = $InitialDir
    }
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.FileName
    }
    return $null
}

# Yes/No prompt
function Confirm-YesNo {
    param(
        [string]$Question,
        [string]$DefaultAnswer = "N"
    )
    $hint = if ($DefaultAnswer -eq "Y") { "[Y/n]" } else { "[y/N]" }
    $answer = Read-Host "$Question $hint"
    if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $DefaultAnswer }
    return $answer -match "^[Yy]"
}

# Convert a Windows path to forward-slash form for JSON
function Convert-ToJsonPath {
    param([string]$Path)
    if (-not $Path) { return "" }
    return ($Path -replace '\\', '/')
}

# === Main ===

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "  issue_manager Setup (config.json generator)" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""
Write-Info "This wizard will create config.json in:"
Write-Info "  $PSScriptRoot"
Write-Info "It does NOT modify any OS environment variables."

# Detect existing config.json
$configJson    = Join-Path $PSScriptRoot "config.json"
$configExample = Join-Path $PSScriptRoot "config.example.json"

$existing = $null
if (Test-Path $configJson) {
    Write-Host ""
    Write-Host "  Existing config.json was found." -ForegroundColor Yellow
    if (-not (Confirm-YesNo "Edit it (current values become defaults)?" "Y")) {
        Write-Skip "Keeping existing config.json. Exiting."
        Write-Host ""
        Write-Host "Press Enter to exit..." -ForegroundColor Gray
        Read-Host | Out-Null
        exit 0
    }
    try {
        $existing = Get-Content -Raw -Encoding UTF8 -LiteralPath $configJson | ConvertFrom-Json
    } catch {
        Write-Warn "Could not parse existing config.json. Starting fresh."
        $existing = $null
    }
}

# Defaults from existing config.json (or hard defaults)
$defaultRoot    = if ($existing -and $existing.root)         { [string]$existing.root }         else { "" }
$defaultPort    = if ($existing -and $existing.port)         { [int]$existing.port }            else { 5180 }
$defaultNode    = if ($existing -and $existing.nodeExe)      { [string]$existing.nodeExe }      else { "node" }
$defaultBomFix  = if ($existing -and $existing.bomFixerPath) { [string]$existing.bomFixerPath } else { "" }
$defaultLogDir  = if ($existing -and $existing.logDir)       { [string]$existing.logDir }       else { Convert-ToJsonPath (Join-Path $PSScriptRoot "logs") }
$defaultPrjName = if ($existing -and $existing.projectName)  { [string]$existing.projectName }  else { "" }

# --- 1. root (required) ---

Write-Title "1/5: Project Root Directory (required)"
Write-Info "The parent directory where issue_manager looks for projects."
Write-Info "Each project is a subfolder under this. Example: G:\claudedir"

$rootPath = $null
if ($defaultRoot) {
    Write-Host ""
    Write-Host "  Current value: $defaultRoot" -ForegroundColor Yellow
    if (-not (Confirm-YesNo "Change it?" "N")) {
        $rootPath = $defaultRoot
        Write-Skip "Keeping current root."
    }
}

if (-not $rootPath) {
    Write-Host ""
    Write-Host "  Opening folder selection dialog..." -ForegroundColor Gray
    $initial = if ($defaultRoot) { ($defaultRoot -replace '/', '\') } else { "" }
    $selected = Select-Folder -Description "Select the project root directory (e.g. G:\claudedir)" -InitialPath $initial
    if (-not $selected) {
        Write-Warn "Cancelled. Setup aborted (root is required)."
        Write-Host ""
        Write-Host "Press Enter to exit..." -ForegroundColor Gray
        Read-Host | Out-Null
        exit 1
    }
    $rootPath = Convert-ToJsonPath $selected
    Write-Ok "root = $rootPath"
}

# --- 2. port ---

Write-Title "2/5: Server Port"
Write-Info "Default is 5180. Change this if you want to run multiple"
Write-Info "issue_manager instances on the same PC (each instance needs"
Write-Info "its own port and its own config.json)."

Write-Host ""
Write-Host "  Current value: $defaultPort" -ForegroundColor Yellow
$portInput = Read-Host "Port (Enter to keep $defaultPort)"
$portValue = $defaultPort
if (-not [string]::IsNullOrWhiteSpace($portInput)) {
    $parsed = 0
    if ([int]::TryParse($portInput, [ref]$parsed) -and $parsed -ge 1 -and $parsed -le 65535) {
        $portValue = $parsed
    } else {
        Write-Warn "Invalid port. Keeping $defaultPort."
    }
}
Write-Ok "port = $portValue"

# --- 3. nodeExe (optional) ---

Write-Title "3/5: Node.js Executable Path (optional)"
Write-Info "If 'node' is on your PATH, leave it as 'node'."
Write-Info "Otherwise, specify the full path to node.exe."

Write-Host ""
Write-Host "  Current value: $defaultNode" -ForegroundColor Yellow
$nodeValue = $defaultNode
if (Confirm-YesNo "Change it?" "N") {
    $initialDir = ""
    if ($defaultNode -and ($defaultNode -ne "node") -and (Test-Path ($defaultNode -replace '/', '\'))) {
        $initialDir = Split-Path ($defaultNode -replace '/', '\') -Parent
    }
    $nodePath = Select-File -Title "Select node.exe (Cancel to keep 'node')" -Filter "Node executable (node.exe)|node.exe|All files (*.*)|*.*" -InitialDir $initialDir
    if ($nodePath) {
        $nodeValue = Convert-ToJsonPath $nodePath
        Write-Ok "nodeExe = $nodeValue"
    } else {
        Write-Skip "Cancelled. Keeping current value."
    }
} else {
    Write-Skip "Keeping current value."
}

# Quick sanity check
if ($nodeValue -eq "node") {
    try {
        $cmd = Get-Command node -ErrorAction SilentlyContinue
        if ($cmd) { Write-Info "Found node on PATH: $($cmd.Source)" }
        else      { Write-Warn "'node' was not found on PATH. Install Node.js or set a full path here." }
    } catch {}
}

# --- 4. bomFixerPath (optional) ---

Write-Title "4/5: BOM Fixer Tool Path (optional)"
Write-Info "Path to a tool that strips UTF-8 BOM from .bat files generated by Claude."
Write-Info "Leave blank if you don't have one. Example:"
Write-Info "  G:/claudedir/_tools/BOM_Fixer_v1.bat"

Write-Host ""
Write-Host "  Current value: $(if ($defaultBomFix) { $defaultBomFix } else { '(none)' })" -ForegroundColor Yellow
$bomValue = $defaultBomFix
if (Confirm-YesNo "Change it?" "N") {
    $initialDir = ""
    if ($defaultBomFix -and (Test-Path ($defaultBomFix -replace '/', '\'))) {
        $initialDir = Split-Path ($defaultBomFix -replace '/', '\') -Parent
    } elseif (Test-Path $rootPath.Replace('/', '\')) {
        $initialDir = $rootPath.Replace('/', '\')
    }
    $bomPath = Select-File -Title "Select BOM fixer (Cancel to clear)" -Filter "Batch file (*.bat)|*.bat|All files (*.*)|*.*" -InitialDir $initialDir
    if ($bomPath) {
        $bomValue = Convert-ToJsonPath $bomPath
        Write-Ok "bomFixerPath = $bomValue"
    } else {
        $bomValue = ""
        Write-Skip "Cleared."
    }
} else {
    Write-Skip "Keeping current value."
}

# --- 5. logDir (optional) ---

Write-Title "5/5: Log Directory"
Write-Info "Directory for start_debug.log and server.log."
Write-Info "You can keep the default. A logs folder will be created if needed."

Write-Host ""
Write-Host "  Current value: $defaultLogDir" -ForegroundColor Yellow
$logDirValue = $defaultLogDir
if (Confirm-YesNo "Change it?" "N") {
    $initialDir = ""
    if ($defaultLogDir -and (Test-Path ($defaultLogDir -replace '/', '\'))) {
        $initialDir = $defaultLogDir -replace '/', '\'
    } elseif (Test-Path $PSScriptRoot) {
        $initialDir = $PSScriptRoot
    }
    $logDirPath = Select-Folder -Description "Select log directory" -InitialPath $initialDir
    if ($logDirPath) {
        $logDirValue = Convert-ToJsonPath $logDirPath
        Write-Ok "logDir = $logDirValue"
    } else {
        Write-Skip "Cancelled. Keeping current value."
    }
} else {
    Write-Skip "Keeping current value."
}

try {
    $logDirFs = $logDirValue -replace '/', '\'
    if (-not [System.IO.Path]::IsPathRooted($logDirFs)) {
        $logDirFs = Join-Path $PSScriptRoot $logDirFs
    }
    if (-not (Test-Path -LiteralPath $logDirFs)) {
        New-Item -ItemType Directory -Path $logDirFs -Force | Out-Null
        Write-Ok "Created log directory: $logDirFs"
    }
} catch {
    Write-Warn "Could not create log directory now. It may be created on start."
}

# --- Build and write config.json ---

Write-Title "Writing config.json"

# We hand-build the JSON so we keep the descriptive _comment_* keys.
# Path values are written with forward slashes for cross-platform friendliness.
$rootJson    = ($rootPath  | ConvertTo-Json -Compress)
$nodeJson    = ($nodeValue | ConvertTo-Json -Compress)
$bomJson     = ($bomValue  | ConvertTo-Json -Compress)
$logDirJson  = ($logDirValue | ConvertTo-Json -Compress)
$prjNameJson = ($defaultPrjName | ConvertTo-Json -Compress)

$json = @"
{
  "_comment": "issue_manager instance config. Change port when running multiple instances on the same PC. CLI args override this file.",
  "_comment_format": "Since v1.1, environment-variable expansion syntax is not used. Write values directly.",

  "port": $portValue,
  "_comment_port": "Server port number. Default is 5180. Use another port for multiple instances.",

  "root": $rootJson,
  "_comment_root": "Root directory for project search. On Windows, forward slashes are recommended. If blank, the parent directory of issue_manager is used.",

  "nodeExe": $nodeJson,
  "_comment_nodeExe": "Node executable used by start.bat. Use node if it is available in PATH. Full path example: C:/Program Files/nodejs/node.exe",

  "bomFixerPath": $bomJson,
  "_comment_bomFixerPath": "Path to a tool that strips UTF-8 BOM from .bat files. Leave blank if not used.",

  "logDir": $logDirJson,
  "_comment_logDir": "Directory for debug logs. Relative paths are resolved from the issue_manager folder.",

  "projectName": $prjNameJson
}
"@

# Write as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($configJson, $json, $utf8NoBom)
Write-Ok "Wrote: $configJson"

# --- Summary ---

Write-Title "Setup Complete"

Write-Host ""
Write-Host "  config.json contents:" -ForegroundColor Cyan
Write-Host "    port         = $portValue"  -ForegroundColor Green
Write-Host "    root         = $rootPath"   -ForegroundColor Green
Write-Host "    nodeExe      = $nodeValue"  -ForegroundColor Green
if ($bomValue)     { Write-Host "    bomFixerPath = $bomValue" -ForegroundColor Green }
else               { Write-Host "    bomFixerPath = (none)"    -ForegroundColor DarkGray }
Write-Host "    logDir       = $logDirValue" -ForegroundColor Green

Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Cyan
Write-Host "    1. Double-click start.bat to launch the server" -ForegroundColor White
Write-Host "    2. Browser will open http://127.0.0.1:$portValue/" -ForegroundColor White
Write-Host ""
Write-Host "  Multi-instance tip:" -ForegroundColor Cyan
Write-Host "    Copy this entire issue_manager folder elsewhere," -ForegroundColor White
Write-Host "    run install.bat there with a different port, and you" -ForegroundColor White
Write-Host "    can run both instances side by side." -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host | Out-Null
