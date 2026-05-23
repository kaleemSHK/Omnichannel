# Start BlinkOne telephony stack (Prompt 5 step 1)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)

Write-Host "Starting telephony profile (Asterisk + Kamailio + RTPEngine)..."
docker compose `
  -f docker-compose.yml `
  -f docker-compose.blinkone.yml `
  -f docker-compose.telephony.yml `
  --profile telephony `
  up -d --build

Write-Host ""
Write-Host "Hand-test: Zoiper -> 127.0.0.1:5062 user 1000 / AST_AGENT_SIP_PASS -> dial 1000 (park)"
Write-Host "Docs: docs/blinkone/TELEPHONY_STEP1.md"
