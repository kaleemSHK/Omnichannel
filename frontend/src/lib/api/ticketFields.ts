import { bnFetch } from './client';

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

export async function listTicketFields(): Promise<TicketField[]> {
  const res = await bnFetch<{ data: TicketField[] }>(SVC, '/v1/fields');
  return res.data ?? [];
}

export async function createTicketField(
  payload: Omit<TicketField, 'id'>,
): Promise<TicketField> {
  const res = await bnFetch<{ data: TicketField }>(SVC, '/v1/fields', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteTicketField(id: string): Promise<void> {
  await bnFetch(SVC, `/v1/fields/${id}`, { method: 'DELETE' });
}
