param(
  [int]$IntervalSeconds = 10,
  [switch]$Once
)

$ErrorActionPreference = "Continue"
$env:GIT_TERMINAL_PROMPT = "0"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$LogFile = Join-Path $RepoRoot ".git/auto-sync.log"

function Log($msg) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "$ts $msg" | Tee-Object -FilePath $LogFile -Append | Out-Null
  Write-Output "$ts $msg"
}

$mutex = New-Object System.Threading.Mutex($false, "Global\PROJECT2-AutoSync")
if (-not $mutex.WaitOne(0)) {
  Write-Output "auto-sync already running, exiting."
  exit 0
}

try {
  do {
    # 1. Fetch first so we see other PCs quickly
    git fetch origin --quiet 2>&1 | Out-Null

    # 2. Pull if behind (autostash keeps uncommitted work safe)
    $behind = "0"
    try { $behind = (git rev-list HEAD..@{u} --count 2>$null).Trim() } catch {}
    if ($behind -match '^\d+$' -and [int]$behind -gt 0) {
      Log "pulling $behind commit(s) from origin..."
      git pull --rebase --autostash 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        git rebase --abort 2>$null | Out-Null
        Log "CONFLICT: pull failed, manual fix needed (git status). Skipping push this cycle."
        if ($Once) { exit 2 }
        Start-Sleep -Seconds $IntervalSeconds
        continue
      }
      Log "pull done."
    }

    # 3. Push local changes if any
    $dirty = git status --porcelain
    if ($dirty) {
      git add -A
      $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
      git commit -m "auto-sync: $env:COMPUTERNAME $stamp" --quiet
      if ($LASTEXITCODE -eq 0) {
        git push 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
          # Other PC pushed first: rebase then retry once
          git pull --rebase --autostash 2>&1 | Out-Null
          if ($LASTEXITCODE -eq 0) { git push 2>&1 | Out-Null }
        }
        if ($LASTEXITCODE -eq 0) { Log "pushed auto-commit." }
        else { Log "push failed (auth or conflict). Run git status." }
      }
    }

    if ($Once) { exit 0 }
    Start-Sleep -Seconds $IntervalSeconds
  } while ($true)
}
finally {
  $mutex.ReleaseMutex() | Out-Null
}
