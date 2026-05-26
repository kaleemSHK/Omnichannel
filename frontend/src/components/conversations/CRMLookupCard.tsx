'use client';

import { useQuery } from '@tanstack/react-query';
import { User, Phone, Mail, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { getContact } from '@/lib/api/contacts';
import { lookupContactAll, type ContactLookupResult } from '@/lib/api/connectors';
import { isDemoDataEnabled } from '@/lib/demo/config';
import type { CWContact } from '@/types';

interface Props {
  /** Chatwoot contact/sender ID — used to fetch phone + email */
  contactId: number;
}

const DEMO_CW_CONTACT: CWContact = {
  id: 0,
  name: 'Arman Malik',
  email: 'arman.malik@acme.com',
  phone_number: '+923001234567',
  labels: [],
  created_at: new Date().toISOString(),
};

const DEMO_CRM_RESULT: ContactLookupResult = {
  id: 'sf-001',
  name: 'Arman Malik',
  email: 'arman.malik@acme.com',
  phone: '+92 300 1234567',
  source: 'salesforce',
  sourceLabel: 'Salesforce',
};

export function CRMLookupCard({ contactId }: Props) {
  // Step 1: Fetch the Chatwoot contact to get phone/email
  const { data: contact, isLoading: contactLoading } = useQuery<CWContact>({
    queryKey: ['cw-contact', contactId],
    queryFn: (): Promise<CWContact> => {
      if (isDemoDataEnabled()) return Promise.resolve({ ...DEMO_CW_CONTACT, id: contactId });
      return getContact(contactId);
    },
    staleTime: 5 * 60 * 1000,
  });

  const phone = contact?.phone_number ?? undefined;
  const email = contact?.email ?? undefined;

  // Step 2: Fan-out lookup against all CRM connectors
  const { data: crmContact, isLoading: crmLoading, isError } = useQuery<ContactLookupResult | null>({
    queryKey: ['crm-lookup', phone, email],
    queryFn: (): Promise<ContactLookupResult | null> => {
      if (isDemoDataEnabled()) return Promise.resolve(DEMO_CRM_RESULT);
      return lookupContactAll(phone, email);
    },
    enabled: !!(phone || email),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const isLoading = contactLoading || crmLoading;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Looking up CRM…
      </div>
    );
  }

  if (isError || !crmContact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <AlertCircle className="w-3 h-3" />
        No CRM record found
      </div>
    );
  }

  const sourceColor: Record<string, string> = {
    salesforce: 'bg-blue-50 text-blue-700',
    microsoft_dynamics: 'bg-purple-50 text-purple-700',
    generic_rest: 'bg-gray-100 text-gray-700',
    sap_b1: 'bg-yellow-50 text-yellow-700',
    oracle_fusion: 'bg-red-50 text-red-700',
  };

  const badgeClass = sourceColor[crmContact.source] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-background border rounded-md p-3 space-y-2">
      {/* Source badge */}
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
        {crmContact.sourceLabel}
      </span>

      {/* Name */}
      {crmContact.name && (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <User className="w-3 h-3 text-muted-foreground shrink-0" />
          {crmContact.name}
        </div>
      )}

      {/* Phone */}
      {crmContact.phone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="w-3 h-3 shrink-0" />
          <span className="truncate">{crmContact.phone}</span>
        </div>
      )}

      {/* Email */}
      {crmContact.email && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{crmContact.email}</span>
        </div>
      )}

      {/* CRM record ID */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
        <ExternalLink className="w-3 h-3" />
        <span className="truncate">ID: {crmContact.id}</span>
      </div>
    </div>
  );
}
