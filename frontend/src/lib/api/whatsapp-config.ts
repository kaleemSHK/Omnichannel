import { bnFetch } from './client';

export interface WhatsAppConfig {
  metaAppId: string;
  metaAppSecret: string;
  metaVerifyToken: string;
  phoneNumberId: string;
  accessToken: string;
  businessPhone: string;
  chatwootInboxId: string;
  messagingEnabled: boolean;
  callingEnabled: boolean;
  allowUnsignedWebhook: boolean;
  webhookUrl: string;
  chatwootWebhookUrl: string;
  hasMetaAppSecret?: boolean;
  hasAccessToken?: boolean;
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const res = await bnFetch<{ data: WhatsAppConfig }>('platform', '/v1/whatsapp-config');
  return res.data;
}

export async function updateWhatsAppConfig(
  patch: Partial<WhatsAppConfig>,
): Promise<WhatsAppConfig> {
  const res = await bnFetch<{ data: WhatsAppConfig }>('platform', '/v1/whatsapp-config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.data;
}
