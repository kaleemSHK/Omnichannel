/**
 * Capture WebRTC call audio in the browser and upload to the recording service.
 */

import { useAuthStore } from '@/lib/store/auth';
import { GATEWAY_URL } from '@/lib/env';

type RecorderHandle = {
  stop: () => Promise<Blob | null>;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return types.find(t => MediaRecorder.isTypeSupported(t));
}

function tracksFromPeer(pc: RTCPeerConnection | undefined): MediaStreamTrack[] {
  if (!pc) return [];
  const tracks: MediaStreamTrack[] = [];
  for (const r of pc.getReceivers()) {
    if (r.track?.kind === 'audio') tracks.push(r.track);
  }
  for (const s of pc.getSenders()) {
    if (s.track?.kind === 'audio') tracks.push(s.track);
  }
  return tracks;
}

/** Start recording mixed local + remote audio for a JsSIP session. */
export function startCallRecording(session: { connection?: RTCPeerConnection }): RecorderHandle | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const tracks = tracksFromPeer(session.connection);
  if (!tracks.length) return null;

  const stream = new MediaStream(tracks);
  const mime = pickMimeType();
  let recorder: MediaRecorder;
  const chunks: Blob[] = [];

  try {
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch {
    return null;
  }

  recorder.ondataavailable = (ev) => {
    if (ev.data?.size) chunks.push(ev.data);
  };
  recorder.start(1000);

  return {
    stop: () =>
      new Promise(resolve => {
        if (recorder.state === 'inactive') {
          resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType }) : null);
          return;
        }
        recorder.onstop = () => {
          resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType }) : null);
        };
        try {
          recorder.stop();
        } catch {
          resolve(null);
        }
      }),
  };
}

export async function uploadCallRecording(params: {
  callSessionId: string;
  blob: Blob;
  durationMs?: number;
  direction?: 'inbound' | 'outbound';
}): Promise<{ id: string; storageKey?: string } | null> {
  const { tokens, user } = useAuthStore.getState();
  const tenantId = user?.tenantId ?? '1';
  const form = new FormData();
  form.append('callSessionId', params.callSessionId);
  form.append('callId', params.callSessionId);
  form.append('chatwootAccountId', String(tenantId));
  form.append('tenantId', String(tenantId));
  if (params.durationMs != null) form.append('durationMs', String(params.durationMs));
  if (params.direction) form.append('direction', params.direction);
  const ext = params.blob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('audio', params.blob, `call.${ext}`);

  const headers: Record<string, string> = {
    'X-Blinkone-Tenant-Id': String(tenantId),
  };
  if (tokens?.gatewayJwt) headers.Authorization = `Bearer ${tokens.gatewayJwt}`;

  const res = await fetch(`${GATEWAY_URL}/api/recordings/v1/recordings`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string; storage_key?: string; storageKey?: string };
    id?: string;
    storage_key?: string;
    storageKey?: string;
  } | null;
  const row = json?.data ?? json;
  const id = row?.id ? String(row.id) : null;
  if (!id) return null;
  const storageKey = row?.storageKey ?? row?.storage_key;
  return storageKey ? { id, storageKey: String(storageKey) } : { id };
}
