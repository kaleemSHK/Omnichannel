# Full client demo — Chatwoot + enterprise sidecars (one command)
param(
  [string]$TenantId = '1',
  [string]$Plan = 'business',
  [switch]$SkipChatwoot
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "BlinkOne CLIENT DEMO seed" -ForegroundColor Cyan
Write-Host "Ensure stack is up: docker compose up -d" -ForegroundColor DarkGray

$args = @("scripts/seed-client-demo.mjs", "--tenant-id=$TenantId", "--plan=$Plan")
if ($SkipChatwoot) { $args += '--skip-chatwoot' }

node @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nOpen: http://127.0.0.1/app/login" -ForegroundColor Green
Write-Host "Login: demo.agent@blinkone.ai / DemoAgent1!" -ForegroundColor Green
