# Deploy agent/routing fixes using Windows OpenSSH (Git Bash ssh often lacks keys).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HostTarget = if ($env:BLINKONE_HOST) { $env:BLINKONE_HOST } else { 'root@204.168.137.104' }
$Remote = if ($env:BLINKONE_REMOTE) { $env:BLINKONE_REMOTE } else { '/opt/blinkone' }
$SshOpts = @('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')

$Files = @(
  'docker-compose.yml',
  'gateway/lib/push.js',
  'gateway/lib/device-routes.js',
  'gateway/lib/customer-routes.js',
  'services/routing/lib/call-queue-status.js',
  'services/routing/lib/route-request.js',
  'services/routing/lib/queue-worker.js',
  'services/routing/lib/agent-repo.js',
  'services/routing/lib/route-assign.js',
  'services/routing/lib/notify-calls-ring.js',
  'services/routing/lib/dial-target.js',
  'services/routing/src/server.js',
  'services/ivr/lib/main-support-flow-graph.js',
  'services/calls/lib/push-notify.js',
  'infra/kamailio/kamailio-twilio-wss.cfg',
  'services/calls/lib/chatwoot-broadcast.js',
  'services/recording/lib/stt-hook.js',
  'services/recording/src/server.js',
  'frontend/src/lib/api/routing.ts',
  'frontend/src/lib/api/calls.ts',
  'frontend/src/lib/calling/incoming-call-ui.ts',
  'frontend/src/lib/calling/sync-call-teardown.ts',
  'frontend/src/lib/telephony/sip-audio.ts',
  'frontend/src/lib/hooks/useJsSip.ts',
  'frontend/src/components/calling/PhonePanel.tsx',
  'frontend/src/components/calling/CallingWorkspace.tsx',
  'frontend/src/components/conversations/ConversationIncomingCallBanner.tsx',
  'frontend/src/components/conversations/MessageThread.tsx',
  'frontend/src/lib/utils/calling.ts',
  'frontend/src/types/index.ts',
  'services/calls/lib/cdr-repo.js',
  'services/calls/src/server.js',
  'services/routing/lib/notify-calls-ring.js',
  'services/routing/lib/route-assign.js',
  'frontend/src/lib/telephony/call-recording.ts',
  'frontend/src/lib/utils/calling.ts',
  'frontend/src/components/calling/CallHistoryView.tsx',
  'scripts/deploy-recording-agent-fix.sh',
  'scripts/seed-routing-agent-names.sh',
)

Write-Host "=== Sync $($Files.Count) files to $HostTarget ==="
foreach ($f in $Files) {
  $dir = Split-Path -Parent $f
  & ssh @SshOpts $HostTarget "mkdir -p ${Remote}/${dir}"
  if ($LASTEXITCODE -ne 0) { throw "ssh mkdir failed for $f" }
  & scp @SshOpts (Join-Path $Root $f) "${HostTarget}:${Remote}/$f"
  if ($LASTEXITCODE -ne 0) { throw "scp failed for $f" }
  Write-Host "  ok $f"
}

Write-Host '=== Remote build + restart ==='
$remoteScript = @'
set -euo pipefail
cd /opt/blinkone

touch .env
grep -q '^PUSH_CALLS_ENABLED=' .env || echo 'PUSH_CALLS_ENABLED=1' >> .env
grep -q '^AUTO_STT_ON_RECORDING=' .env || echo 'AUTO_STT_ON_RECORDING=1' >> .env
grep -q '^STT_LANGUAGE_HINT=' .env || echo 'STT_LANGUAGE_HINT=ar-OM' >> .env
grep -q '^FCM_SERVER_KEY=' .env || echo 'FCM_SERVER_KEY=' >> .env

docker compose build gateway calls recording routing
docker compose up -d --force-recreate gateway calls recording routing
docker compose restart kamailio 2>/dev/null || true

SEED_TENANT=1 API_BASE=http://127.0.0.1:8787/api node scripts/seed-main-support-ivr.mjs 2>&1 | tail -8 || echo "IVR seed skipped"
bash scripts/seed-routing-agent-names.sh 2>&1 | tail -5 || echo "agent name seed skipped"

cd frontend
# Stop before build — npm rebuild wipes .next/standalone and PM2 crash-loops nginx (ERR_CONNECTION_RESET)
pm2 stop blinkone-frontend 2>/dev/null || true
npm run build 2>&1 | tail -30
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
test -f .next/standalone/server.js && echo "standalone OK" || (echo "standalone MISSING" && exit 1)
pm2 start blinkone-frontend --update-env 2>/dev/null || pm2 restart blinkone-frontend --update-env
pm2 save

echo "=== Smoke ==="
curl -sf -o /dev/null -w "gateway %{http_code}\n" http://127.0.0.1:8787/health
curl -sf -o /dev/null -w "app %{http_code}\n" https://app.blinksone.com/login
echo "Deploy complete."
'@

$remoteScript | & ssh @SshOpts $HostTarget 'bash -s'
if ($LASTEXITCODE -ne 0) { throw 'Remote deploy failed' }
Write-Host 'Done.'
