/** Remote WebRTC audio — element must live in the DOM for reliable playback. */

const REMOTE_AUDIO_ID = '__bn_sip_remote__';

export function ensureSipAudioElements(): HTMLAudioElement {
  if (typeof document === 'undefined') {
    return new Audio();
  }
  let el = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
  if (!el) {
    el = document.createElement('audio');
    el.id = REMOTE_AUDIO_ID;
    el.autoplay = true;
    el.setAttribute('playsinline', 'true');
    el.setAttribute('playsInline', 'true');
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  el.volume = 1;
  return el;
}

/** Unlock playback after a user gesture (browser autoplay policy). */
export async function unlockSipAudio(): Promise<void> {
  const el = ensureSipAudioElements();
  try {
    await el.play();
    el.pause();
    el.currentTime = 0;
  } catch {
    /* ignore until real media */
  }
}

export async function playRemoteAudio(stream: MediaStream): Promise<void> {
  const el = ensureSipAudioElements();
  el.srcObject = stream;
  try {
    await el.play();
  } catch (err) {
    console.warn('[SIP audio] play() blocked — click anywhere on the page once', err);
  }
}

export function clearRemoteAudio(): void {
  const el = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
  if (el) {
    el.pause();
    el.srcObject = null;
  }
}

interface SessionWithPc {
  connection?: RTCPeerConnection;
  _bnAudioBound?: boolean;
}

/** Bind track events and attach any existing audio receivers. */
export function bindSessionRemoteAudio(session: SessionWithPc): void {
  const conn = session.connection;
  if (!conn) return;

  const attachFromReceivers = () => {
    const receivers = conn.getReceivers?.() ?? [];
    const track = receivers.find(r => r.track?.kind === 'audio')?.track;
    if (track) {
      void playRemoteAudio(new MediaStream([track]));
      return true;
    }
    const legacy = conn as RTCPeerConnection & { getRemoteStreams?: () => MediaStream[] };
    const streams = legacy.getRemoteStreams?.() ?? [];
    if (streams.length > 0) {
      void playRemoteAudio(streams[0]);
      return true;
    }
    return false;
  };

  attachFromReceivers();

  if (session._bnAudioBound) return;
  session._bnAudioBound = true;

  conn.addEventListener('track', (ev: RTCTrackEvent) => {
    if (ev.track.kind !== 'audio') return;
    const stream = ev.streams[0] ?? new MediaStream([ev.track]);
    void playRemoteAudio(stream);
    ev.track.onunmute = () => {
      void playRemoteAudio(stream);
    };
  });

  conn.addEventListener('iceconnectionstatechange', () => {
    const state = conn.iceConnectionState;
    if (state === 'connected' || state === 'completed') {
      attachFromReceivers();
    }
  });
}
