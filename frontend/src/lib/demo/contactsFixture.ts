import type { CWContact } from '@/types';

export const DEMO_CONTACTS: CWContact[] = [
  {
    id: 101,
    name: 'Amina Al-Rashdi',
    email: 'amina@labbik.om',
    phone_number: '+968 9211 3344',
    location: 'Muscat, OM',
    labels: ['vip', 'gold'],
    company: { id: 1, name: 'LABBIK Telecom' },
    created_at: '2024-06-12T08:00:00Z',
  },
  {
    id: 102,
    name: 'Mohammed Al-Saidi',
    email: 'mohammed@example.om',
    phone_number: '+968 9912 7788',
    location: 'Salalah, OM',
    labels: ['silver'],
    company: { id: 2, name: 'Gulf Retail Group' },
    created_at: '2024-08-01T10:00:00Z',
  },
  {
    id: 103,
    name: 'Fatima Al-Lawati',
    email: 'fatima@techstart.om',
    phone_number: '+968 9500 1122',
    location: 'Sohar, OM',
    labels: ['bronze'],
    company: { id: 3, name: 'TechStart Oman' },
    created_at: '2025-01-20T14:30:00Z',
  },
  {
    id: 104,
    name: 'Hamad Al-Kindi',
    email: 'hamad@enterprise.om',
    phone_number: '+968 9800 4455',
    location: 'Muscat, OM',
    labels: ['gold', 'enterprise'],
    company: { id: 4, name: 'Enterprise Holdings' },
    created_at: '2023-11-05T09:00:00Z',
  },
  {
    id: 105,
    name: 'Layla Al-Mamari',
    email: 'layla@home.om',
    phone_number: '+968 9123 6677',
    location: 'Nizwa, OM',
    labels: ['silver'],
    created_at: '2025-03-10T11:00:00Z',
  },
];

export function filterDemoContacts(query: string): CWContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return DEMO_CONTACTS;
  return DEMO_CONTACTS.filter(
    c =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone_number?.includes(q) ||
      c.company?.name.toLowerCase().includes(q),
  );
}
