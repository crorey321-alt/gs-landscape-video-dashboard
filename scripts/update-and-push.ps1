$ErrorActionPreference = 'Stop'

$NodeExe = 'C:\Program Files\nodejs\node.exe'
$GitExe = 'C:\Program Files\Git\cmd\git.exe'
$RepoDir = Split-Path -Parent $PSScriptRoot
Set-Location $RepoDir

$LogDir = Join-Path $RepoDir 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$LogFile = Join-Path $LogDir 'update.log'

function Write-Log($msg) {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "$ts  $msg" | Out-File -FilePath $LogFile -Append -Encoding utf8
}

try {
    $genOutput = & $NodeExe 'scripts/generate.mjs'
    if ($LASTEXITCODE -ne 0) { throw "generate.mjs failed (exit $LASTEXITCODE)" }
    Write-Log "generate: $genOutput"

    & $GitExe add index.html
    & $GitExe diff --cached --quiet
    $hasChanges = ($LASTEXITCODE -ne 0)

    if ($hasChanges) {
        $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        & $GitExe commit -m "auto: 데이터 갱신 $ts" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "git commit failed (exit $LASTEXITCODE)" }
        & $GitExe push origin main
        if ($LASTEXITCODE -ne 0) { throw "git push failed (exit $LASTEXITCODE)" }
        Write-Log "OK - pushed update"
    } else {
        Write-Log "OK - no changes"
    }
} catch {
    Write-Log "FAILED - $($_.Exception.Message)"
    exit 1
}
