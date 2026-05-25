# Start ngrok tunnels for BlinkOne Android + Twilio demo (no public IP).
# Run from repo root: .\infra\ngrok\start-demo.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

$config = Join-Path $repoRoot 'infra\ngrok\ngrok.yml'
$globalConfig = Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'

if (-not (Test-Path $config)) {
  $example = Join-Path $repoRoot 'infra\ngrok\ngrok.yml.example'
  if (Test-Path $example) {
    Copy-Item $example $config
    Write-Host "Created $config from example." -ForegroundColor Yellow
  } else {
    Write-Host "Missing $config - copy infra/ngrok/ngrok.yml.example to ngrok.yml" -ForegroundColor Red
    exit 1
  }
}

if (-not (Test-Path $globalConfig)) {
  Write-Host "No global ngrok config at $globalConfig" -ForegroundColor Red
  Write-Host "Run: ngrok config add-authtoken <your-token>" -ForegroundColor Yellow
  exit 1
}

$ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokCmd) {
  $wingetNgrok = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe'
  if (Test-Path $wingetNgrok) {
    $ngrokExe = $wingetNgrok
  } else {
    Write-Host "ngrok not found. Install: winget install ngrok.ngrok" -ForegroundColor Red
    exit 1
  }
} else {
  $ngrokExe = $ngrokCmd.Source
}

$versionLine = & $ngrokExe version 2>&1 | Select-Object -First 1
if ($versionLine -match '(\d+)\.(\d+)\.(\d+)') {
  $ver = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])" 
  if ($ver -lt [version]'3.20.0') {
    Write-Host "ngrok $ver is too old for your account (need 3.20+). Running ngrok update..." -ForegroundColor Yellow
    & $ngrokExe update 2>&1 | Out-Host
  }
}

$logFile = Join-Path $repoRoot 'infra\ngrok\ngrok-demo.log'
$configArgs = @('--config', $globalConfig, '--config', $config)
& $ngrokExe config check @configArgs 2>&1 | Out-String | Write-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "ngrok config check failed. Fix infra/ngrok/ngrok.yml (use version `"2`", no placeholder authtoken)." -ForegroundColor Red
  exit 1
}

$existing = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Stopping existing ngrok process(es)..." -ForegroundColor DarkGray
  $existing | Stop-Process -Force
  Start-Sleep -Seconds 1
}

Write-Host "Starting ngrok tunnels for BlinkOne demo..." -ForegroundColor Cyan
Write-Host "  $ngrokExe start --all --config $globalConfig --config $config" -ForegroundColor DarkGray
$startArgs = @('start', '--all', '--log', $logFile, '--log-level', 'info') + $configArgs
Start-Process -FilePath $ngrokExe -ArgumentList $startArgs -WorkingDirectory $repoRoot

$deadline = (Get-Date).AddSeconds(30)
$tunnels = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get
    if ($tunnels.tunnels.Count -gt 0) { break }
  } catch {
    # ngrok still starting
  }
}

if (-not $tunnels -or $tunnels.tunnels.Count -eq 0) {
  Write-Host "Could not reach ngrok API at http://127.0.0.1:4040" -ForegroundColor Red
  if (Test-Path $logFile) {
    $tail = Get-Content $logFile -Tail 12 -ErrorAction SilentlyContinue
    if ($tail) {
      Write-Host ''
      Write-Host '--- ngrok log (last lines) ---' -ForegroundColor DarkGray
      $tail | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
    }
    if ($tail -match 'ERR_NGROK_121|too old') {
      Write-Host ''
      Write-Host 'Fix: ngrok update   (account requires agent 3.20+)' -ForegroundColor Yellow
    }
    if ($tail -match 'ERR_NGROK_8013|TCP endpoints') {
      Write-Host ''
      Write-Host 'Fix: Free ngrok accounts need a card on file for TCP tunnels (SIP + WSS).' -ForegroundColor Yellow
      Write-Host '     https://dashboard.ngrok.com/settings#id-verification' -ForegroundColor Yellow
      Write-Host '     (card is for abuse prevention; ngrok says it is not charged for this step)' -ForegroundColor DarkGray
    }
    if ($tail -match 'YOUR_NGROK_AUTH_TOKEN|ERR_NGROK_105') {
      Write-Host ''
      Write-Host 'Fix: Remove authtoken from infra/ngrok/ngrok.yml; use: ngrok config add-authtoken <token>' -ForegroundColor Yellow
    }
  }
  Write-Host ''
  Write-Host 'Other causes: ports 80/5060/8089 not listening (start Docker + nginx first)' -ForegroundColor Yellow
  Write-Host "Try manually: ngrok start --all --config `"$globalConfig`" --config `"$config`"" -ForegroundColor DarkGray
  exit 1
}

Write-Host ''
Write-Host '=== NGROK TUNNEL ADDRESSES ===' -ForegroundColor Green
foreach ($t in $tunnels.tunnels) {
  $name = $t.name
  $url = $t.public_url
  Write-Host ('  {0} : {1}' -f $name, $url) -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=== UPDATE AFTER EACH NGROK RESTART ===' -ForegroundColor Cyan
Write-Host '1. frontend/.env.local'
Write-Host '   NEXT_PUBLIC_SIP_WSS = wss://<host>:<port>  (asterisk-wss TCP tunnel)'
Write-Host '   NEXT_PUBLIC_WS_URL  = wss://<blinkone-web https host>/cable'
Write-Host '2. Twilio Console -> Elastic SIP Trunk -> Origination'
Write-Host '   sip:<sip-signal host>:<sip-signal port>   e.g. sip:0.tcp.ngrok.io:12345'
Write-Host '3. Restart frontend dev server (NEXT_PUBLIC_* are baked at start):'
Write-Host '   cd frontend; npm run dev'
Write-Host ''
Write-Host 'Open ngrok dashboard: http://127.0.0.1:4040' -ForegroundColor DarkGray
