import type { TicketField } from '@/lib/api/ticketFields';

export const DEMO_TICKET_FIELDS: TicketField[] = [
  {
    id: 'demo-field-1',
    field_key: 'order_id',
    label: 'Order ID',
    field_type: 'text',
    required: false,
    sort_order: 0,
  },
];
