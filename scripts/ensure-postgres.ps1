# Script to ensure PostgreSQL 18 is running for the Attendance Management System
$ErrorActionPreference = 'SilentlyContinue'
$pgData = "C:\Program Files\PostgreSQL\18\data"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$port = 5432

# 1. Check if port 5432 is already actively listening
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Output "PostgreSQL is already running and listening on port $port."
    exit 0
}

# 2. Check for and clean up stale postmaster.pid lock file if server is dead
$pidFile = Join-Path $pgData "postmaster.pid"
if (Test-Path $pidFile) {
    $lines = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($lines -and $lines.Count -ge 1) {
        $stalePid = [int]$lines[0]
        $proc = Get-Process -Id $stalePid -ErrorAction SilentlyContinue
        if (-not $proc -or $proc.ProcessName -notmatch "postgres") {
            Write-Output "Removing stale postmaster.pid (PID $stalePid is not running)..."
            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
        }
    } else {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

# 3. Start PostgreSQL using pg_ctl (no log file parameter to avoid file sharing lock)
$pgCtl = Join-Path $pgBin "pg_ctl.exe"

Write-Output "Starting PostgreSQL on port $port..."
& $pgCtl start -D $pgData -s

# 4. Wait up to 10 seconds for server to listen
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        Write-Output "PostgreSQL successfully started and listening on port $port."
        exit 0
    }
}

Write-Output "PostgreSQL start command finished."
