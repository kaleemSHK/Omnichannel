# Diagnose missing BlinkOne Chatwoot UI (wrong image, missing overlay, missing patch)
$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $repoRoot

Write-Host "`n=== BlinkOne Chatwoot UI check ===" -ForegroundColor Cyan

# 1. Overlay on disk
$overlay = Join-Path $repoRoot 'chatwoot-fork-overlay\app\javascript\dashboard\blinkone_components'
if (Test-Path $overlay) {
  $n = (Get-ChildItem $overlay -Recurse -File).Count
  Write-Host "[OK] chatwoot-fork-overlay on disk ($n files under blinkone_components)" -ForegroundColor Green
} else {
  Write-Host "[FAIL] chatwoot-fork-overlay missing - UI source not in repo" -ForegroundColor Red
}

$callsTab = Join-Path $repoRoot 'chatwoot-fork-overlay\app\javascript\dashboard\blinkone_components\Calling\CallsInboxTabs.vue'
if (Test-Path $callsTab) {
  Write-Host "[OK] CallsInboxTabs.vue present" -ForegroundColor Green
} else {
  Write-Host "[WARN] CallsInboxTabs.vue missing" -ForegroundColor Yellow
}

# 2. Git tracking
$gitStatus = git status --porcelain chatwoot-fork-overlay 2>$null
if ($gitStatus -match '^\?\?') {
  Write-Host "[WARN] chatwoot-fork-overlay is NOT committed to git - risk of losing changes" -ForegroundColor Yellow
} elseif ($gitStatus) {
  Write-Host "[INFO] chatwoot-fork-overlay has uncommitted changes" -ForegroundColor DarkGray
} else {
  Write-Host "[OK] chatwoot-fork-overlay tracked in git" -ForegroundColor Green
}

# 3. .env image
$envFile = Join-Path $repoRoot '.env'
$img = 'blinkone/chatwoot:v4.13.0-ce-b1'
if (Test-Path $envFile) {
  $line = Select-String -Path $envFile -Pattern '^CHATWOOT_IMAGE=' | Select-Object -First 1
  if ($line) {
    $img = ($line.Line -replace '^CHATWOOT_IMAGE=', '').Trim()
    if ($img -match '^chatwoot/chatwoot:') {
      Write-Host "[FAIL] CHATWOOT_IMAGE=$img (upstream CE - no BlinkOne UI)" -ForegroundColor Red
      Write-Host "       Set CHATWOOT_IMAGE=blinkone/chatwoot:v4.13.0-ce-b1 and rebuild" -ForegroundColor Yellow
    } elseif ($img -match '^blinkone/chatwoot') {
      Write-Host "[OK] CHATWOOT_IMAGE=$img" -ForegroundColor Green
    } else {
      Write-Host "[?] CHATWOOT_IMAGE=$img" -ForegroundColor Yellow
    }
  } else {
    Write-Host "[INFO] CHATWOOT_IMAGE not in .env - compose default blinkone/chatwoot:v4.13.0-ce-b1" -ForegroundColor DarkGray
  }
} else {
  Write-Host "[WARN] No .env - copy from .env.example" -ForegroundColor Yellow
}

# 4. Running container
try {
  $running = docker ps --filter 'name=chatwoot' --format '{{.Names}}' 2>$null | Select-Object -First 1
  if (-not $running) {
    Write-Host "[INFO] chatwoot container not running - start Docker and: docker compose up -d" -ForegroundColor DarkGray
    exit 0
  }
  $used = docker inspect $running --format '{{.Config.Image}}' 2>$null
  Write-Host "[INFO] Running image: $used" -ForegroundColor DarkGray
  if ($used -match '^chatwoot/chatwoot:') {
    Write-Host "[FAIL] Container uses upstream image - rebuild BlinkOne image" -ForegroundColor Red
  }
  $patch = docker exec $running sh -c "grep -c CallsInboxTabs /app/app/javascript/dashboard/components/ChatList.vue" 2>$null
  if ($patch -eq '0') {
    Write-Host "[FAIL] ChatList.vue not patched (no CallsInboxTabs) - rebuild chatwoot image" -ForegroundColor Red
  } else {
    Write-Host "[OK] ChatList.vue patched for calling inbox" -ForegroundColor Green
  }
  $panel = docker exec $running test -f /app/app/javascript/dashboard/blinkone_components/Calling/CallsListPanel.vue 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Calling overlay files inside container" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] Calling overlay missing in container - rebuild" -ForegroundColor Red
  }
  $bundle = docker exec $running sh -c "grep -l CallsInboxTabs /app/public/vite/assets/dashboard*.js 2>/dev/null | head -1" 2>$null
  if ($bundle) {
    Write-Host "[OK] CallsInboxTabs in compiled dashboard bundle" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] CallsInboxTabs not in Vite bundle - run full image build" -ForegroundColor Red
  }
} catch {
  Write-Host "[INFO] Docker not available: $_" -ForegroundColor DarkGray
}

Write-Host "`nRebuild UI: .\scripts\blinkone\build-chatwoot-image.ps1" -ForegroundColor Cyan
Write-Host "Docs: docs/blinkone/CHATWOOT_UI_WHY_CHANGES_DISAPPEAR.md`n" -ForegroundColor DarkGray
