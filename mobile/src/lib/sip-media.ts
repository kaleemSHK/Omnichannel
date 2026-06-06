import { installWebRtcGlobals } from '@/lib/webrtc';
import { startCallAudio } from '@/lib/audio';

type MediaStreamLike = {
  getTracks: () => { stop: () => void }[];
};

/** Acquire mic for JsSIP — avoids JsSIP internal getUserMedia on React Native. */
export async function getLocalAudioStream(): Promise<MediaStreamLike> {
  if (!installWebRtcGlobals()) {
    throw new Error('WebRTC not available on this build');
  }
  const md = (
    globalThis as {
      navigator?: { mediaDevices?: { getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStreamLike> } };
    }
  ).navigator?.mediaDevices;
  if (!md?.getUserMedia) {
    throw new Error('navigator.mediaDevices.getUserMedia missing');
  }
  return md.getUserMedia({ audio: true, video: false });
}

export async function prepareOutboundCallAudio(): Promise<MediaStreamLike> {
  const stream = await getLocalAudioStream();
  await startCallAudio();
  return stream;
}
