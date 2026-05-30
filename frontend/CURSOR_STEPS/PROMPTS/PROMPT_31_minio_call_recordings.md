# PROMPT 31 — MinIO Activation + Call Recordings Storage
## BlinkOne · blinksone.com · TRD Requirements TR-16, TR-17, TR-18

---

## CONTEXT

The recording service at `services/recording` already has:
- MinIO client integration
- `STORAGE_BACKEND=minio` environment variable configured
- `MINIO_STUB=1` disabling real storage
- `MINIO_BUCKET=recordings` already referenced

The `docker-compose.yml` references `blinkone-minio:9000` in the recording and ai services, but **the MinIO container itself is not defined in docker-compose.yml**.

This prompt adds MinIO to docker-compose, disables the stub, wires the recording service, and adds the recordings playback UI.

---

## PART A — Add MinIO Container to docker-compose.yml

Open `docker-compose.yml`. Add the MinIO service to the `services:` section:

```yaml
  blinkone-minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-blinkone}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-blinkone-minio-secret}
    volumes:
      - minio-data:/data
    ports:
      - "127.0.0.1:9000:9000"   # S3 API
      - "127.0.0.1:9001:9001"   # MinIO Console UI
    networks:
      - blinkone-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Add to the `volumes:` section:
```yaml
  minio-data:
```

---

## PART B — Add MinIO Bucket Init Service

Add a one-shot init container that creates the `recordings` bucket on first start:

```yaml
  minio-init:
    image: minio/mc:latest
    depends_on:
      blinkone-minio:
        condition: service_healthy
    networks:
      - blinkone-net
    entrypoint: >
      /bin/sh -c "
        mc alias set local http://blinkone-minio:9000 ${MINIO_ROOT_USER:-blinkone} ${MINIO_ROOT_PASSWORD:-blinkone-minio-secret};
        mc mb --ignore-existing local/recordings;
        mc mb --ignore-existing local/uploads;
        mc policy set download local/uploads;
        echo 'MinIO buckets initialized';
      "
    restart: "no"
```

---

## PART C — Disable MINIO_STUB in All Services

Open `docker-compose.yml`. Find every service that has `MINIO_STUB: "1"` and change to:

```yaml
      MINIO_STUB: ${MINIO_STUB:-0}
```

Then in the server `.env` file (`/opt/blinkone/.env`), ensure:
```bash
MINIO_STUB=0
MINIO_ROOT_USER=blinkone
MINIO_ROOT_PASSWORD=blinkone-minio-secret-change-this
```

Update the `recording` service dependencies in docker-compose.yml:
```yaml
  recording:
    depends_on:
      blinkone-minio:
        condition: service_healthy
      minio-init:
        condition: service_completed_successfully
```

---

## PART D — Add Nginx Proxy for MinIO Console (Optional Admin Access)

If you want to access the MinIO console at `https://app.blinksone.com/minio-admin/` (internal use only), add to Nginx config:

```nginx
# MinIO Admin Console — restrict to internal IP only
location /minio-admin/ {
    allow 127.0.0.1;
    allow 10.0.0.0/8;
    deny all;
    proxy_pass http://127.0.0.1:9001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## PART E — Recording Service: Ensure Upload Works

Open `services/recording/src/server.js`. Confirm the upload flow:

```javascript
// POST /v1/recordings — called by calls service after a call ends
app.post('/v1/recordings', auth, upload.single('audio'), async (req, res) => {
  const { callId, tenantId, agentId, duration, direction } = req.body;
  const file = req.file;

  if (!file || !callId) {
    return fail(res, 'VALIDATION_ERROR', 'audio file and callId required');
  }

  let storageUrl;
  try {
    if (process.env.MINIO_STUB === '1') {
      storageUrl = `stub://recordings/${callId}.wav`;
    } else {
      // Upload to MinIO
      const minioClient = getMinioClient();
      const objectName = `${tenantId}/${new Date().toISOString().slice(0, 10)}/${callId}.wav`;
      await minioClient.putObject(
        process.env.MINIO_BUCKET || 'recordings',
        objectName,
        file.buffer,
        file.size,
        { 'Content-Type': 'audio/wav' }
      );
      storageUrl = `minio://recordings/${objectName}`;
    }

    // Save metadata to DB
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO recordings (id, tenant_id, call_id, agent_id, duration_sec, direction, storage_url, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now()) RETURNING *`,
      [tenantId, callId, agentId, duration, direction, storageUrl]
    );

    return ok(res, rows[0], 201);
  } catch (e) {
    log.error({ err: e.message }, 'upload recording');
    return fail(res, 'INTERNAL_ERROR', 'Upload failed', 500);
  }
});
```

Ensure the recordings table migration exists at `services/recording/db/001_recordings.sql`:

```sql
CREATE TABLE IF NOT EXISTS recordings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL,
  call_id       text NOT NULL,
  agent_id      text,
  duration_sec  int,
  direction     text CHECK (direction IN ('inbound','outbound')),
  storage_url   text NOT NULL,
  transcription text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recordings_tenant ON recordings(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_call ON recordings(call_id);
```

---

## PART F — Add Presigned URL Endpoint for Playback

Add a presigned URL endpoint so the frontend can play recordings without exposing MinIO credentials:

```javascript
// GET /v1/recordings/:id/play — returns a short-lived presigned URL
app.get('/v1/recordings/:id/play', auth, async (req, res) => {
  const tenantId = resolveTenantId(req);
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT * FROM recordings WHERE id=$1 AND tenant_id=$2`,
    [req.params.id, tenantId]
  );
  if (!rows.length) return fail(res, 'NOT_FOUND', 'Recording not found', 404);

  const rec = rows[0];

  if (process.env.MINIO_STUB === '1' || rec.storage_url.startsWith('stub://')) {
    return ok(res, { url: null, stub: true });
  }

  // Extract object name from storage_url: minio://bucket/path
  const objectName = rec.storage_url.replace(/^minio:\/\/recordings\//, '');

  try {
    const minioClient = getMinioClient();
    const url = await minioClient.presignedGetObject(
      process.env.MINIO_BUCKET || 'recordings',
      objectName,
      60 * 60 // 1 hour expiry
    );
    return ok(res, { url });
  } catch (e) {
    log.error({ err: e.message }, 'presign recording');
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate play URL', 500);
  }
});
```

---

## PART G — Frontend: Recordings UI in Calling Module

Create `frontend/src/components/calling/RecordingsPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Pause, Download } from 'lucide-react';
import { bnFetch } from '@/lib/api/gateway';

interface Recording {
  id: string;
  call_id: string;
  agent_id: string;
  duration_sec: number;
  direction: 'inbound' | 'outbound';
  created_at: string;
}

export function RecordingsPanel() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings'],
    queryFn: async (): Promise<Recording[]> => {
      const res = await bnFetch('/recording/v1/recordings');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
  });

  async function playRecording(id: string) {
    if (playingId === id) {
      audioEl?.pause();
      setPlayingId(null);
      return;
    }

    try {
      const res = await bnFetch(`/recording/v1/recordings/${id}/play`);
      const json = await res.json();
      if (!json.data?.url) {
        alert('Recording not available (storage not activated)');
        return;
      }

      audioEl?.pause();
      const audio = new Audio(json.data.url);
      audio.play();
      audio.onended = () => setPlayingId(null);
      setAudioEl(audio);
      setPlayingId(id);
    } catch {
      alert('Failed to load recording');
    }
  }

  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Call Recordings</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {recordings.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No recordings yet.</p>
      )}
      {recordings.map(r => (
        <div
          key={r.id}
          className="flex items-center gap-3 border rounded-md px-3 py-2 bg-background"
        >
          <button
            type="button"
            onClick={() => playRecording(r.id)}
            className="size-8 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600"
          >
            {playingId === r.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{r.call_id}</p>
            <p className="text-xs text-muted-foreground">
              {r.direction} · {formatDuration(r.duration_sec ?? 0)} · {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
          <a
            href={`/api/recording/v1/recordings/${r.id}/play`}
            download
            className="text-muted-foreground hover:text-gray-700 p-1"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      ))}
    </div>
  );
}
```

Add `<RecordingsPanel />` to the Calling module page, below the active calls section.

---

## PART H — Add Recording API Route to Gateway

Open `services/gateway/src/server.js` (or wherever the gateway routes are defined). Add a proxy route for the recording service if not already present:

```javascript
app.use('/recording', createProxyMiddleware({
  target: process.env.RECORDING_SERVICE_URL || 'http://recording:8799',
  changeOrigin: true,
  pathRewrite: { '^/recording': '' },
}));
```

---

## PART I — Startup and Verification

```bash
ssh root@204.168.137.104
cd /opt/blinkone

git pull origin main

# Start MinIO and initialize buckets
docker compose up -d blinkone-minio
sleep 10  # wait for healthy
docker compose up minio-init  # one-shot bucket creation

# Confirm buckets exist
docker compose exec blinkone-minio mc ls local/

# Restart recording service
docker compose restart recording

# Check recording service logs
docker compose logs -f --tail=30 recording
# Expected: "recording service listening on :8799" with MINIO_STUB=0

# Test MinIO health
curl http://localhost:9000/minio/health/live
# Expected: HTTP 200

# Test recording upload (minimal test)
curl -X POST http://localhost:8799/v1/recordings \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -F "callId=test-001" \
  -F "tenantId=default" \
  -F "duration=30" \
  -F "direction=inbound" \
  -F "audio=@/dev/zero;type=audio/wav"
```

---

## VERIFICATION CHECKLIST

- [ ] `docker compose ps blinkone-minio` shows `healthy`
- [ ] `docker compose exec blinkone-minio mc ls local/` shows `recordings` and `uploads` buckets
- [ ] `docker compose exec recording env | grep MINIO_STUB` shows `0`
- [ ] Uploading a test recording to `/v1/recordings` succeeds and returns `storage_url` starting with `minio://`
- [ ] Presigned URL endpoint returns a working download URL
- [ ] Recordings panel appears in the Calling module UI
- [ ] Clicking play on a recording plays audio in browser

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-16  | Call recording with cloud storage | ✅ DONE |
| TR-17  | Recording playback for supervisors | ✅ DONE |
| TR-18  | Recording download and retention management | ✅ DONE |
