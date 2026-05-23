# Build blinkone/chatwoot image with enough Node heap for Vite (Windows)
# Requires Docker Desktop RAM >= 10 GB (Settings → Resources)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)

Write-Host "Building blinkone/chatwoot:v4.13.0-ce-b1 (NODE heap 8GB inside build)..."
Write-Host "If this fails with OOM, increase Docker Desktop memory to 10GB+ or use Dockerfile.nobuild"

$env:DOCKER_BUILDKIT = "1"
docker compose build chatwoot

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Full build failed. Try lightweight image (no i18n bundle rebuild):" -ForegroundColor Yellow
  Write-Host "  docker build -f docker/chatwoot-blinkone/Dockerfile.nobuild -t blinkone/chatwoot:v4.13.0-ce-b1-nobuild ."
  exit $LASTEXITCODE
}

Write-Host "Done. Run: docker compose up -d"
