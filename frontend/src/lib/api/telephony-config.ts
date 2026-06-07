import { bnFetch } from './client';

export interface TelephonyConfig {
  twilioTrunkHost: string;
  outboundCallerId: string;
  inboundVoiceWebhook: string;
  callStatusWebhook: string;
  sipWssUrl: string;
  ringTimeoutSec: number;
  syncHangupBothLegs: boolean;
  trialAccount: boolean;
}

export async function getTelephonyConfig(): Promise<TelephonyConfig> {
  const res = await bnFetch<{ data: TelephonyConfig }>('platform', '/v1/telephony-config');
  return res.data;
}

export async function updateTelephonyConfig(
  patch: Partial<TelephonyConfig>,
): Promise<TelephonyConfig> {
  const res = await bnFetch<{ data: TelephonyConfig }>('platform', '/v1/telephony-config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}
