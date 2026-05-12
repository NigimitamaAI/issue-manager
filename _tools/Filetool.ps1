# ============================================================
# File Operations v2 (PowerShell core)
#
# Features:
#   - Execute instruction-file operations with confirmation.
#   - Built-in UTF-8 no-BOM repair. No temporary ps1 is generated.
#   - Direct drag-and-drop mode: drop multiple files to run BOMFIX.
#
# Instruction commands:
#   MKDIR <dir>
#   MOVE "<src>" "<dst>"
#   COPY "<src>" "<dst>"
#   COPYDIR "<src>" "<dst>"
#   DELETE "<path>"
#   DELETE_PERMANENT "<path>"
#   RENAME "<oldpath>" "<newname>"
#   BOMFIX "<path>"
#   FIXBOM "<path>"
#   UTF8NOBOM "<path>"
#   UTF8_NO_BOM "<path>"
# ============================================================
param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$InputPaths
)

$ErrorActionPreference = 'Stop'
try { chcp 65001 > $null } catch {}
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $scriptDir 'logs'
$logFile = Join-Path $logDir 'file_ops.log'

if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-OpLog {
    param([string]$Tag, [string]$Detail)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath $logFile -Value "$ts $Tag $Detail" -Encoding UTF8
}

function Write-Usage {
    Write-Host ''
    Write-Host 'USAGE' -ForegroundColor Cyan
    Write-Host '  1. Drop an instruction file onto Filetool.bat'
    Write-Host '  2. Drop one or more source files onto Filetool.bat to run BOMFIX directly'
    Write-Host ''
    Write-Host 'Instruction examples:'
    Write-Host '  MKDIR "G:\claudedir\test_dir"'
    Write-Host '  MOVE "G:\claudedir\a.txt" "G:\claudedir\test_dir\a.txt"'
    Write-Host '  BOMFIX "G:\claudedir\issue_manager\start.bat"'
    Write-Host ''
}

function Split-Args {
    param([string]$Text)
    $tokens = @()
    $current = ''
    $inQuote = $false
    for ($i = 0; $i -lt $Text.Length; $i++) {
        $ch = $Text[$i]
        if ($ch -eq '"') {
            $inQuote = -not $inQuote
            continue
        }
        if (-not $inQuote -and [char]::IsWhiteSpace($ch)) {
            if ($current.Length -gt 0) {
                $tokens += $current
                $current = ''
            }
            continue
        }
        $current += $ch
    }
    if ($current.Length -gt 0) { $tokens += $current }
    return $tokens
}

$KnownCommands = @(
    'MKDIR', 'MOVE', 'COPY', 'COPYDIR', 'DELETE', 'DELETE_PERMANENT', 'RENAME',
    'BOMFIX', 'FIXBOM', 'UTF8NOBOM', 'UTF8_NO_BOM'
)

function Get-Utf8LinesStrictOrLenient {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
        if ($bytes.Length -eq 3) { $bytes = [byte[]]::new(0) } else { $bytes = $bytes[3..($bytes.Length - 1)] }
    }
    try {
        $strict = New-Object System.Text.UTF8Encoding($false, $true)
        $text = $strict.GetString($bytes)
    } catch {
        # Instruction files from old tools may be CP932. Use PowerShell default fallback only for parsing instructions.
        $text = Get-Content -LiteralPath $Path -Raw
    }
    $text = $text.TrimStart([char]0xFEFF)
    return ($text -split "`r`n|`n|`r")
}

function Test-InstructionFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    try {
        $lines = Get-Utf8LinesStrictOrLenient -Path $Path
        foreach ($line in $lines) {
            $t = $line.Trim().TrimStart([char]0xFEFF)
            if ([string]::IsNullOrWhiteSpace($t)) { continue }
            if ($t.StartsWith('#')) { continue }
            $tokens = Split-Args $t
            if ($tokens.Count -eq 0) { continue }
            return ($KnownCommands -contains $tokens[0].ToUpperInvariant())
        }
        return $false
    } catch {
        return $false
    }
}

function Get-InstructionOps {
    param([string]$InstructionFile)
    $rawLines = Get-Utf8LinesStrictOrLenient -Path $InstructionFile
    $ops = @()
    foreach ($line in $rawLines) {
        $trimmed = $line.Trim().TrimStart([char]0xFEFF)
        if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
        if ($trimmed.StartsWith('#')) { continue }
        $ops += $trimmed
    }
    return $ops
}

function Test-TextFileExtension {
    param([string]$Path)
    $ext = [System.IO.Path]::GetExtension($Path)
    $allowed = @('.bat', '.cmd', '.ps1', '.py', '.js', '.mjs', '.ts', '.json', '.md', '.txt', '.html', '.css', '.xml', '.yml', '.yaml', '.toml', '.csv')
    return ($allowed -contains $ext.ToLowerInvariant())
}

function Do-FixUtf8NoBom {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        Write-Host '  [SKIP] empty path' -ForegroundColor Yellow
        return 'skip'
    }
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Host "  [FAIL] file not found: $Path" -ForegroundColor Red
        Write-OpLog 'BOMFIX_NOTFOUND' $Path
        return 'failed'
    }
    if (Test-Path -LiteralPath $Path -PathType Container) {
        Write-Host "  [SKIP] directory is not supported: $Path" -ForegroundColor Yellow
        Write-OpLog 'BOMFIX_DIR_SKIP' $Path
        return 'skip'
    }
    if (-not (Test-TextFileExtension -Path $Path)) {
        Write-Host "  [WARN] unexpected extension. Processing as text: $Path" -ForegroundColor Yellow
        Write-OpLog 'BOMFIX_WARN_EXT' $Path
    }

    try {
        $full = [System.IO.Path]::GetFullPath($Path)
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $hadBom = $false
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
            if ($bytes.Length -eq 3) { $bytes = [byte[]]::new(0) } else { $bytes = $bytes[3..($bytes.Length - 1)] }
            $hadBom = $true
        }

        $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
        try {
            $text = $strictUtf8.GetString($bytes)
        } catch {
            Write-Host "  [FAIL] not valid UTF-8. Skip to avoid mojibake: $Path" -ForegroundColor Red
            Write-OpLog 'BOMFIX_INVALID_UTF8' $Path
            return 'failed'
        }

        $backup = $full + '.bak'
        Copy-Item -LiteralPath $full -Destination $backup -Force

        $text = $text -replace "`r`n|`n|`r", "`r`n"
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($full, $text, $utf8NoBom)

        if ($hadBom) {
            Write-Host "  [OK] UTF-8 BOM removed + CRLF normalized: $Path" -ForegroundColor Green
            Write-OpLog 'BOMFIX_REMOVED' "$Path | backup=$backup"
        } else {
            Write-Host "  [OK] UTF-8 no BOM + CRLF normalized: $Path" -ForegroundColor Green
            Write-OpLog 'BOMFIX_OK' "$Path | backup=$backup"
        }
        Write-Host "  [OK] backup: $backup" -ForegroundColor Green
        return 'success'
    } catch {
        Write-Host "  [FAIL] BOMFIX failed: $Path - $_" -ForegroundColor Red
        Write-OpLog 'BOMFIX_FAIL' "$Path | $_"
        return 'failed'
    }
}

function Do-Mkdir {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { Write-Host '  [SKIP] empty path' -ForegroundColor Yellow; return 'skip' }
    if (Test-Path -LiteralPath $Path) { Write-Host "  [OK] already exists: $Path" -ForegroundColor Green; Write-OpLog 'MKDIR_EXIST' $Path; return 'success' }
    try { New-Item -ItemType Directory -Path $Path -Force | Out-Null; Write-Host "  [OK] created: $Path" -ForegroundColor Green; Write-OpLog 'MKDIR_OK' $Path; return 'success' }
    catch { Write-Host "  [FAIL] mkdir failed: $Path - $_" -ForegroundColor Red; Write-OpLog 'MKDIR_FAIL' "$Path | $_"; return 'failed' }
}

function Do-Move {
    param([string]$Src, [string]$Dst)
    if ([string]::IsNullOrWhiteSpace($Src) -or [string]::IsNullOrWhiteSpace($Dst)) { Write-Host '  [SKIP] need 2 paths' -ForegroundColor Yellow; return 'skip' }
    if (-not (Test-Path -LiteralPath $Src)) { Write-Host "  [FAIL] source not found: $Src" -ForegroundColor Red; Write-OpLog 'MOVE_NOSRC' "$Src -> $Dst"; return 'failed' }
    if (Test-Path -LiteralPath $Dst) { Write-Host "  [FAIL] destination already exists: $Dst" -ForegroundColor Red; Write-OpLog 'MOVE_DST_EXIST' "$Src -> $Dst"; return 'failed' }
    try { $dstParent = Split-Path -Parent $Dst; if ($dstParent -and -not (Test-Path -LiteralPath $dstParent)) { New-Item -ItemType Directory -Path $dstParent -Force | Out-Null }; Move-Item -LiteralPath $Src -Destination $Dst; Write-Host "  [OK] moved: $Src -> $Dst" -ForegroundColor Green; Write-OpLog 'MOVE_OK' "$Src -> $Dst"; return 'success' }
    catch { Write-Host "  [FAIL] move failed: $_" -ForegroundColor Red; Write-OpLog 'MOVE_FAIL' "$Src -> $Dst | $_"; return 'failed' }
}

function Do-Copy {
    param([string]$Src, [string]$Dst, [bool]$Recurse)
    if ([string]::IsNullOrWhiteSpace($Src) -or [string]::IsNullOrWhiteSpace($Dst)) { Write-Host '  [SKIP] need 2 paths' -ForegroundColor Yellow; return 'skip' }
    if (-not (Test-Path -LiteralPath $Src)) { Write-Host "  [FAIL] source not found: $Src" -ForegroundColor Red; Write-OpLog 'COPY_NOSRC' "$Src -> $Dst"; return 'failed' }
    try { $dstParent = Split-Path -Parent $Dst; if ($dstParent -and -not (Test-Path -LiteralPath $dstParent)) { New-Item -ItemType Directory -Path $dstParent -Force | Out-Null }; if ($Recurse) { Copy-Item -LiteralPath $Src -Destination $Dst -Recurse -Force; Write-Host "  [OK] copydir: $Src -> $Dst" -ForegroundColor Green; Write-OpLog 'COPYDIR_OK' "$Src -> $Dst" } else { Copy-Item -LiteralPath $Src -Destination $Dst -Force; Write-Host "  [OK] copied: $Src -> $Dst" -ForegroundColor Green; Write-OpLog 'COPY_OK' "$Src -> $Dst" }; return 'success' }
    catch { Write-Host "  [FAIL] copy failed: $_" -ForegroundColor Red; Write-OpLog 'COPY_FAIL' "$Src -> $Dst | $_"; return 'failed' }
}

function Do-Delete {
    param([string]$Path, [bool]$Permanent)
    if ([string]::IsNullOrWhiteSpace($Path)) { Write-Host '  [SKIP] empty path' -ForegroundColor Yellow; return 'skip' }
    if (-not (Test-Path -LiteralPath $Path)) { Write-Host "  [SKIP] not found: $Path" -ForegroundColor Yellow; Write-OpLog 'DEL_NOTFOUND' $Path; return 'skip' }
    Write-Host ''
    if ($Permanent) { Write-Host "  >>> [DANGER] PERMANENT DELETE: $Path" -ForegroundColor Red; Write-Host '  >>> This cannot be undone.' -ForegroundColor Red }
    else { Write-Host "  >>> Send to RECYCLE BIN: $Path" -ForegroundColor Yellow }
    $delConf = Read-Host '  Confirm delete? (y/N)'
    if ($delConf -notmatch '^(y|yes)$') { Write-Host '  [SKIP] user declined' -ForegroundColor Yellow; Write-OpLog 'DEL_DECLINE' $Path; return 'skip' }
    try {
        $resolved = Resolve-Path -LiteralPath $Path
        if ($Permanent) {
            if ((Get-Item -LiteralPath $resolved).PSIsContainer) { Remove-Item -LiteralPath $resolved -Recurse -Force } else { Remove-Item -LiteralPath $resolved -Force }
            Write-Host "  [OK] permanently deleted: $Path" -ForegroundColor Green; Write-OpLog 'DEL_PERM_OK' $Path
        } else {
            Add-Type -AssemblyName Microsoft.VisualBasic
            if ((Get-Item -LiteralPath $resolved).PSIsContainer) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($resolved.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin) }
            else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($resolved.Path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin) }
            Write-Host "  [OK] sent to recycle bin: $Path" -ForegroundColor Green; Write-OpLog 'DEL_RECYCLE_OK' $Path
        }
        return 'success'
    } catch { Write-Host "  [FAIL] delete failed: $_" -ForegroundColor Red; Write-OpLog 'DEL_FAIL' "$Path | $_"; return 'failed' }
}

function Do-Rename {
    param([string]$OldPath, [string]$NewName)
    if ([string]::IsNullOrWhiteSpace($OldPath) -or [string]::IsNullOrWhiteSpace($NewName)) { Write-Host '  [SKIP] need 2 args' -ForegroundColor Yellow; return 'skip' }
    if (-not (Test-Path -LiteralPath $OldPath)) { Write-Host "  [FAIL] source not found: $OldPath" -ForegroundColor Red; Write-OpLog 'RENAME_NOSRC' "$OldPath -> $NewName"; return 'failed' }
    try { Rename-Item -LiteralPath $OldPath -NewName $NewName -Force; Write-Host "  [OK] renamed: $OldPath -> $NewName" -ForegroundColor Green; Write-OpLog 'RENAME_OK' "$OldPath -> $NewName"; return 'success' }
    catch { Write-Host "  [FAIL] rename failed: $_" -ForegroundColor Red; Write-OpLog 'RENAME_FAIL' "$OldPath -> $NewName | $_"; return 'failed' }
}

function Invoke-OperationLines {
    param([string[]]$Ops, [string]$InstructionFile)

    Write-Host ('=' * 60)
    Write-Host ' Claude File Operations v2'
    Write-Host " Instruction: $InstructionFile"
    Write-Host " Date: $(Get-Date)"
    Write-Host ('=' * 60)
    Write-Host ''

    if ($Ops.Count -eq 0) { Write-Host '[INFO] No operations found.' -ForegroundColor Yellow; return }

    Write-Host '[Operations to perform]' -ForegroundColor Cyan
    Write-Host ('-' * 60)
    for ($i = 0; $i -lt $Ops.Count; $i++) { Write-Host ('  {0}. {1}' -f ($i + 1), $Ops[$i]) }
    Write-Host ('-' * 60)
    Write-Host "Total: $($Ops.Count) operation(s)"
    Write-Host ''
    Write-Host '[CONFIRM] Execute all the above operations?'
    Write-Host '  - Y or YES to execute'
    Write-Host '  - anything else to abort'
    Write-Host '  - DELETE / DELETE_PERMANENT will be reconfirmed individually'
    Write-Host ''
    $mainConfirm = Read-Host 'Your choice'
    if ($mainConfirm -notmatch '^(y|yes)$') { Write-Host '[ABORT] User canceled.' -ForegroundColor Yellow; Write-OpLog 'ABORT' $InstructionFile; return }

    Write-OpLog 'START' $InstructionFile
    $success = 0; $failed = 0; $skipped = 0

    for ($i = 0; $i -lt $Ops.Count; $i++) {
        $line = $Ops[$i]
        $no = $i + 1
        Write-Host ''
        Write-Host ("[{0}/{1}] {2}" -f $no, $Ops.Count, $line) -ForegroundColor Cyan
        $tokens = Split-Args $line
        if ($tokens.Count -eq 0) { Write-Host '  [SKIP] empty operation line' -ForegroundColor Yellow; Write-OpLog 'SKIP_EMPTY' $line; $skipped++; continue }
        $cmdU = $tokens[0].ToUpperInvariant()
        if ($tokens.Count -gt 1) { $argv = $tokens[1..($tokens.Count - 1)] } else { $argv = @() }

        $result = 'skip'
        switch ($cmdU) {
            'MKDIR'            { $result = Do-Mkdir $argv[0] }
            'MOVE'             { $result = Do-Move  $argv[0] $argv[1] }
            'COPY'             { $result = Do-Copy  $argv[0] $argv[1] $false }
            'COPYDIR'          { $result = Do-Copy  $argv[0] $argv[1] $true }
            'DELETE'           { $result = Do-Delete $argv[0] $false }
            'DELETE_PERMANENT' { $result = Do-Delete $argv[0] $true }
            'RENAME'           { $result = Do-Rename $argv[0] $argv[1] }
            'BOMFIX'           { $result = Do-FixUtf8NoBom $argv[0] }
            'FIXBOM'           { $result = Do-FixUtf8NoBom $argv[0] }
            'UTF8NOBOM'        { $result = Do-FixUtf8NoBom $argv[0] }
            'UTF8_NO_BOM'      { $result = Do-FixUtf8NoBom $argv[0] }
            default            { Write-Host "  [SKIP] Unknown command: [$cmdU] line=[$line]" -ForegroundColor Yellow; Write-OpLog 'SKIP_UNKNOWN' $line; $result = 'skip' }
        }

        switch ($result) { 'success' { $success++ } 'failed' { $failed++ } default { $skipped++ } }
    }

    Write-Host ''
    Write-Host ('=' * 60)
    Write-Host '[SUMMARY]' -ForegroundColor Cyan
    Write-Host "  Success: $success" -ForegroundColor Green
    Write-Host "  Failed:  $failed" -ForegroundColor Red
    Write-Host "  Skipped: $skipped" -ForegroundColor Yellow
    Write-Host ''
    Write-Host "Log file: $logFile"
    Write-Host ('=' * 60)
    Write-OpLog 'END' "success=$success failed=$failed skipped=$skipped"
}

function Invoke-DirectBomFix {
    param([string[]]$Paths)
    Write-Host ('=' * 60)
    Write-Host ' BOMFIX direct mode'
    Write-Host " Date: $(Get-Date)"
    Write-Host ('=' * 60)
    Write-Host ''
    Write-Host '[Files to fix]' -ForegroundColor Cyan
    for ($i = 0; $i -lt $Paths.Count; $i++) { Write-Host ('  {0}. {1}' -f ($i + 1), $Paths[$i]) }
    Write-Host ''
    Write-Host 'This will create .bak backups, remove UTF-8 BOM if present, and normalize line endings to CRLF.'
    $confirm = Read-Host 'Execute BOMFIX? (y/N)'
    if ($confirm -notmatch '^(y|yes)$') { Write-Host '[ABORT] User canceled.' -ForegroundColor Yellow; Write-OpLog 'BOMFIX_ABORT' ($Paths -join ' | '); return }

    Write-OpLog 'BOMFIX_DIRECT_START' ($Paths -join ' | ')
    $success = 0; $failed = 0; $skipped = 0
    foreach ($p in $Paths) {
        Write-Host ''
        Write-Host "[BOMFIX] $p" -ForegroundColor Cyan
        $r = Do-FixUtf8NoBom $p
        switch ($r) { 'success' { $success++ } 'failed' { $failed++ } default { $skipped++ } }
    }
    Write-Host ''
    Write-Host ('=' * 60)
    Write-Host '[SUMMARY]' -ForegroundColor Cyan
    Write-Host "  Success: $success" -ForegroundColor Green
    Write-Host "  Failed:  $failed" -ForegroundColor Red
    Write-Host "  Skipped: $skipped" -ForegroundColor Yellow
    Write-Host "Log file: $logFile"
    Write-Host ('=' * 60)
    Write-OpLog 'BOMFIX_DIRECT_END' "success=$success failed=$failed skipped=$skipped"
}

try {
    if (-not $InputPaths -or $InputPaths.Count -eq 0) {
        Write-Usage
        Read-Host 'Press Enter to exit'
        exit 1
    }

    if ($InputPaths.Count -eq 1 -and (Test-InstructionFile -Path $InputPaths[0])) {
        $ops = Get-InstructionOps -InstructionFile $InputPaths[0]
        Invoke-OperationLines -Ops $ops -InstructionFile $InputPaths[0]
    } else {
        Invoke-DirectBomFix -Paths $InputPaths
    }

    Read-Host 'Press Enter to exit'
    exit 0
} catch {
    Write-Host "[FATAL] $_" -ForegroundColor Red
    Write-OpLog 'FATAL' "$_"
    Read-Host 'Press Enter to exit'
    exit 1
}
