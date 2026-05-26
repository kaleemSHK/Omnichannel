/**
 * CRM / ERP connector API client — talks to integration service via gateway.
 * Gateway route: /api/integrations → integration:8800
 */

import { bnFetch } from './client';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ConnectorType =
  | 'salesforce'
  | 'microsoft_dynamics'
  | 'generic_rest'
  | 'sap_b1'
  | 'oracle_fusion'
  | 'tasdeeq';

export interface ConnectorRecord {
  id: string;
  connectorType: ConnectorType;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorUpsertPayload {
  connectorType: ConnectorType;
  name: string;
  config: Record<string, unknown>;
}

export interface ContactLookupResult {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  accountId?: string;
  source: string;
  sourceLabel: string;
}

// ─── API calls ─────────────────────────────────────────────────────────────

export async function listConnectors(): Promise<ConnectorRecord[]> {
  const res = await bnFetch<{ data: ConnectorRecord[] }>('integrations', '/v1/connectors');
  return res.data ?? [];
}

export async function upsertConnector(payload: ConnectorUpsertPayload): Promise<ConnectorRecord> {
  const res = await bnFetch<{ data: ConnectorRecord }>('integrations', '/v1/connectors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteConnector(id: string): Promise<void> {
  await bnFetch<void>('integrations', `/v1/connectors/${id}`, { method: 'DELETE' });
}

export async function testConnector(id: string): Promise<{ ok: boolean; latencyMs?: number; detail?: string }> {
  const res = await bnFetch<{ data: { ok: boolean; latencyMs?: number; detail?: string } }>(
    'integrations',
    `/v1/connectors/${id}/healthcheck`,
    { method: 'POST' },
  );
  return res.data ?? { ok: false };
}

/** Fan-out contact lookup across all connected CRM connectors. Returns first hit. */
export async function lookupContactAll(phone?: string, email?: string): Promise<ContactLookupResult | null> {
  try {
    const res = await bnFetch<{ data: ContactLookupResult | null }>('integrations', '/v1/connectors/lookup-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, email }),
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

/** Lookup via a single named connector type. */
export async function lookupContactByType(
  type: ConnectorType,
  phone?: string,
  email?: string,
): Promise<ContactLookupResult | null> {
  try {
    const res = await bnFetch<{ data: ContactLookupResult | null }>(
      'integrations',
      `/v1/connectors/${type}/lookup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      },
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}
