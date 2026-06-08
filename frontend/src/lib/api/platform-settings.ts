import { bnFetch } from './client';

export interface RecordingConfig {
  enabledChannels: { pstn: boolean; whatsapp: boolean; webrtc: boolean };
  announcementEnabled: boolean;
  announcementText: string;
  retentionDays: number;
  storageBackend: 'local' | 's3' | 'azure' | 'gcs';
  storageBucket: string;
  pciAutoPause: boolean;
  pciResumeOnHangup: boolean;
  encryptAtRest: boolean;
  accessRestriction: 'all_agents' | 'supervisors_only' | 'admins_only';
}

export interface VoiceConfig {
  ttsProvider: 'google' | 'azure' | 'elevenlabs' | 'openai';
  ttsLanguage: string;
  ttsVoice: string;
  ttsSpeed: number;
  sttProvider: 'google' | 'azure' | 'whisper' | 'deepgram';
  sttLanguage: string;
  sttHotwords: string;
  aiNluProvider: 'openai' | 'azure' | 'gemini';
  aiNluModel: string;
  nluConfidenceThreshold: number;
  holdMusicEnabled: boolean;
  holdMusicUrl: string;
  mohVolume: number;
  defaultOutboundCallerId: string;
  dtmfTimeout: number;
}

export async function getRecordingConfig(): Promise<RecordingConfig> {
  const res = await bnFetch<{ data: RecordingConfig }>('platform', '/v1/recording-config');
  return res.data;
}

export async function updateRecordingConfig(
  patch: Partial<RecordingConfig>,
): Promise<RecordingConfig> {
  const res = await bnFetch<{ data: RecordingConfig }>('platform', '/v1/recording-config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}

export async function getVoiceConfig(): Promise<VoiceConfig> {
  const res = await bnFetch<{ data: VoiceConfig }>('platform', '/v1/voice-config');
  return res.data;
}

export async function updateVoiceConfig(patch: Partial<VoiceConfig>): Promise<VoiceConfig> {
  const res = await bnFetch<{ data: VoiceConfig }>('platform', '/v1/voice-config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}
