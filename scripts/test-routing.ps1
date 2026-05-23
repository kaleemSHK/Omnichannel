# BlinkOne routing smoke tests (PowerShell)
# Default: direct to routing service with ROUTING_TOKEN from .env (bypasses gateway JWT).
param(
  [string]$BaseUrl,
  [string]$Token,
  [string]$TenantId = 'default',
  [switch]$ViaGateway
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot '.env'

function Read-DotEnvValue {
  param([string]$Name)
  if (-not (Test-Path $envFile)) { return $null }
  foreach ($line in Get-Content $envFile) {
    if ($line -match "^\s*$Name=(.*)$") {
      return $matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

if (-not $Token) { $Token = $env:ROUTING_TOKEN }
if (-not $Token) { $Token = Read-DotEnvValue 'ROUTING_TOKEN' }
if (-not $Token) {
  Write-Error 'ROUTING_TOKEN not set. Add it to .env or pass -Token.'
  exit 1
}

if (-not $BaseUrl) {
  if ($ViaGateway) {
    $BaseUrl = 'http://localhost/api/routing'
    Write-Warning 'ViaGateway requires a Chatwoot JWT. Use direct mode (default) for service-token tests.'
  } else {
    $BaseUrl = 'http://127.0.0.1:8798'
  }
}

$headers = @{
  Authorization          = "Bearer $Token"
  'Content-Type'         = 'application/json'
  'X-Blinkone-Tenant-Id' = $TenantId
}

function Invoke-Routing {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body,
    [switch]$AllowConflict
  )
  $uri = "$BaseUrl$Path"
  $params = @{ Method = $Method; Uri = $uri; Headers = $headers }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6 -Compress) }
  try {
    return Invoke-RestMethod @params
  } catch {
    $detail = $_.ErrorDetails.Message
    if ($AllowConflict -and $detail -match 'CONFLICT') {
      return $null
    }
    if ($detail) { throw "$Method $uri failed: $detail" }
    throw "$Method $uri failed: $($_.Exception.Message)"
  }
}

Write-Host "BaseUrl: $BaseUrl"
Write-Host "Tenant:  $TenantId"
Write-Host "Token:   $($Token.Substring(0, [Math]::Min(4, $Token.Length)))..."

Write-Host "`nEnsure sales queue exists..."
Invoke-Routing -Method POST -Path '/v1/queues' -Body @{
  queueKey = 'sales'
  name     = 'Sales'
  skills   = @(@{ skill = 'sales'; required = $true })
} -AllowConflict | Out-Null
Write-Host "  OK (created or already exists)"

Write-Host "Register / refresh agent 1000..."
Invoke-Routing -Method POST -Path '/v1/agents' -Body @{
  agentId   = '1000'
  status    = 'available'
  skills    = @('sales')
  queueKeys = @('sales')
} -AllowConflict | Out-Null
Invoke-Routing -Method POST -Path '/v1/agents/1000/state' -Body @{
  status    = 'available'
  skills    = @('sales')
  queueKeys = @('sales')
} | Out-Null
Write-Host "  OK (agent available)"

Write-Host "Route request..."
$result = Invoke-Routing -Method POST -Path '/v1/route/request' -Body @{
  queue    = 'sales'
  callId   = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
  callerId = '+15551212'
}
$result | ConvertTo-Json -Depth 5

Write-Host "`nRealtime dashboard..."
Invoke-Routing -Method GET -Path "/v1/dashboards/realtime?tenant_id=$TenantId" | ConvertTo-Json -Depth 4

Write-Host "`nDone."
