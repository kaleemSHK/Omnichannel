import { randomUUID } from 'node:crypto';
import { createLogger } from './logger.js';

const log = createLogger('calls-campaign');

// In-memory campaign store
export const campaigns = new Map(); // tenantId -> Campaign[]

export function createCampaign(tenantId, body) {
  const campaign = {
    id: randomUUID(),
    tenantId: String(tenantId),
    name: body.name,
    type: body.type ?? 'sms', // sms | email | voice
    status: 'draft', // draft | running | paused | completed
    targets: body.targets ?? [], // [{phone, email, name}]
    messageTemplate: body.messageTemplate ?? '',
    scheduledAt: body.scheduledAt ?? null,
    createdAt: new Date().toISOString(),
    sentCount: 0,
    failedCount: 0,
    results: [],
  };
  if (!campaigns.has(String(tenantId))) campaigns.set(String(tenantId), []);
  campaigns.get(String(tenantId)).push(campaign);
  log.info({ campaignId: campaign.id, name: campaign.name, type: campaign.type }, 'campaign created');
  return campaign;
}

export function getCampaigns(tenantId) {
  return campaigns.get(String(tenantId)) ?? [];
}

export function getCampaign(tenantId, id) {
  return (campaigns.get(String(tenantId)) ?? []).find(c => c.id === id) ?? null;
}

export function updateCampaignStatus(tenantId, id, status) {
  const c = getCampaign(tenantId, id);
  if (c) c.status = status;
  return c;
}
