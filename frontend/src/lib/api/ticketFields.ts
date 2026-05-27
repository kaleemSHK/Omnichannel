import { bnFetch, BlinkoneApiError, ensureGatewayJwt } from './client';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DEMO_TICKET_FIELDS } from '@/lib/demo/ticketFieldsFixture';

const SVC = 'tickets';

export interface TicketField {
  id: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'boolean' | 'select' | 'date';
  options?: { value: string; label: string }[];
  required: boolean;
  sort_order: number;
}

let demoFields = [...DEMO_TICKET_FIELDS];

export async function listTicketFields(): Promise<TicketField[]> {
  if (isDemoDataEnabled()) return [...demoFields];
  const res = await bnFetch<{ data: TicketField[] }>(SVC, '/v1/fields');
  return res.data ?? [];
}

export async function createTicketField(
  payload: Omit<TicketField, 'id'>,
): Promise<TicketField> {
  if (isDemoDataEnabled()) {
    const created: TicketField = {
      id: `demo-field-${Date.now()}`,
      ...payload,
    };
    demoFields = [...demoFields, created];
    return created;
  }
  const res = await bnFetch<{ data: TicketField }>(SVC, '/v1/fields', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteTicketField(id: string): Promise<void> {
  if (isDemoDataEnabled()) {
    demoFields = demoFields.filter(f => f.id !== id);
    return;
  }
  await bnFetch(SVC, `/v1/fields/${id}`, { method: 'DELETE' });
}

/** Call before mutations when the UI shows gateway unavailable — retries token exchange. */
export async function refreshTicketFieldsSession(): Promise<void> {
  if (isDemoDataEnabled()) return;
  await ensureGatewayJwt();
}

export function isTicketFieldsGatewayError(e: unknown): boolean {
  return (
    e instanceof BlinkoneApiError &&
    (e.code === 'SKIP_GATEWAY' ||
      e.code === 'NO_GATEWAY_JWT' ||
      e.code === 'GATEWAY_SESSION' ||
      e.code === 'NO_AUTH')
  );
}
