'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, CheckCircle, Clock, Zap } from 'lucide-react';
import { bnFetch } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface MarketplaceItem {
  id: string;
  name: string;
  category: 'crm' | 'erp' | 'messaging' | 'helpdesk' | 'custom';
  description: string;
  logoUrl: string;
  setupWizard: boolean;
  authType: 'oauth2' | 'api_key';
  status: 'available' | 'beta' | 'coming_soon';
}

const STATUS_STYLES = {
  available: { label: 'Available', icon: CheckCircle, cls: 'text-green-600' },
  beta: { label: 'Beta', icon: Zap, cls: 'text-amber-600' },
  coming_soon: { label: 'Coming Soon', icon: Clock, cls: 'text-gray-400' },
};

const CATEGORY_LABELS = { crm: 'CRM', erp: 'ERP', messaging: 'Messaging', helpdesk: 'Help Desk', custom: 'Custom' };

async function getMarketplace(category?: string): Promise<MarketplaceItem[]> {
  const q = category ? `?category=${category}` : '';
  const res = await bnFetch<{ data: MarketplaceItem[] }>('integrations', `/v1/marketplace${q}`);
  return res.data ?? [];
}

export function IntegrationMarketplace() {
  const [category, setCategory] = useState<string>('');
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['marketplace', category],
    queryFn: () => getMarketplace(category || undefined),
  });

  const categories = ['', 'crm', 'erp', 'messaging', 'helpdesk', 'custom'];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-base font-semibold">Integration Marketplace</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Connect BlinkOne to your CRM, ERP, and business tools</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'px-3 py-1 text-xs rounded-full border transition-colors',
              category === c ? 'bg-brand-primary text-white border-brand-primary' : 'border-gray-200 hover:bg-muted',
            )}
          >
            {c ? CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] : 'All'}
          </button>
        ))}
      </div>

      {/* Item grid */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => {
          const s = STATUS_STYLES[item.status];
          const StatusIcon = s.icon;
          return (
            <div
              key={item.id}
              className={cn(
                'border rounded-xl p-4 bg-white space-y-3 transition-shadow',
                item.status !== 'coming_soon' ? 'hover:shadow-md cursor-pointer' : 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{CATEGORY_LABELS[item.category]}</span>
                </div>
                <span className={cn('flex items-center gap-1 text-[10px] font-medium', s.cls)}>
                  <StatusIcon className="w-3 h-3" />
                  {s.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground capitalize">
                  Auth: {item.authType.replace('_', ' ')}
                  {item.setupWizard && ' · Setup wizard'}
                </span>
                {item.status !== 'coming_soon' && (
                  <button type="button" className="flex items-center gap-1 text-xs text-brand-primary hover:underline">
                    Configure <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
