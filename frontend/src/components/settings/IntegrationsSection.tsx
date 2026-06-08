'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listIntegrationApps } from '@/lib/api/settings';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useTenantAccountId } from '@/lib/hooks/useTenantAccountId';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/Sheet';
import {
  MessageSquare,
  Brain,
  Sparkles,
  Phone,
  CreditCard,
  Zap,
  ShoppingBag,
  Copy,
  type LucideIcon,
} from 'lucide-react';

interface IntegrationApp {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  webhookPath: string;
}

const APPS: IntegrationApp[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications in your Slack workspace',
    icon: MessageSquare,
    iconClass: 'bg-purple-100 text-purple-700',
    webhookPath: '/integrations/slack',
  },
  {
    id: 'dialogflow',
    name: 'Dialogflow',
    description: 'Connect Google Dialogflow for AI responses',
    icon: Brain,
    iconClass: 'bg-blue-100 text-blue-700',
    webhookPath: '/integrations/dialogflow',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Enable AI-powered reply suggestions',
    icon: Sparkles,
    iconClass: 'bg-gray-900 text-white',
    webhookPath: '/integrations/openai',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Official Meta WhatsApp Business API',
    icon: Phone,
    iconClass: 'bg-green-100 text-green-700',
    webhookPath: '/integrations/whatsapp',
  },
  {
    id: 'twilio',
    name: 'Twilio SMS',
    description: 'Send and receive SMS via Twilio',
    icon: Phone,
    iconClass: 'bg-red-100 text-red-700',
    webhookPath: '/integrations/twilio',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'View customer payment info in conversations',
    icon: CreditCard,
    iconClass: 'bg-indigo-100 text-indigo-700',
    webhookPath: '/integrations/stripe',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect 5000+ apps via Zapier',
    icon: Zap,
    iconClass: 'bg-orange-100 text-orange-700',
    webhookPath: '/integrations/zapier',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'View order details from Shopify',
    icon: ShoppingBag,
    iconClass: 'bg-green-100 text-green-800',
    webhookPath: '/integrations/shopify',
  },
];

const BASE_WEBHOOK = 'https://gateway.blinkone.ai/hooks';

export function IntegrationsSection() {
  const accountId = useTenantAccountId();
  const [configureApp, setConfigureApp] = useState<IntegrationApp | null>(null);

  const { data: appData } = useQuery({
    queryKey: ['integration-apps', accountId],
    queryFn: async () => {
      if (isDemoDataEnabled()) {
        return {
          payload: [
            { id: 'slack', name: 'Slack', enabled: true },
            { id: 'openai', name: 'OpenAI', enabled: true },
          ],
        };
      }
      try {
        return await listIntegrationApps();
      } catch {
        return { payload: [] };
      }
    },
  });

  const connected = new Set(
    (appData?.payload ?? []).filter(a => a.enabled).map(a => a.id),
  );

  const endpointUrl = configureApp
    ? `${BASE_WEBHOOK}${configureApp.webhookPath}?account=labbik`
    : '';

  function copyUrl() {
    void navigator.clipboard.writeText(endpointUrl);
    toast.success('URL copied to clipboard');
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Integrations"
        description="Connect third-party apps to extend BlinkOne."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {APPS.map(app => {
          const Icon = app.icon;
          const isConnected = connected.has(app.id);
          return (
            <article key={app.id} className="border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${app.iconClass}`}
                >
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{app.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{app.description}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  isConnected
                    ? 'text-green-700 border-green-300 bg-green-50 w-fit'
                    : 'text-muted-foreground w-fit'
                }
              >
                {isConnected ? 'Connected' : 'Not connected'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="mt-auto"
                onClick={() => setConfigureApp(app)}
              >
                Configure
              </Button>
            </article>
          );
        })}
      </div>

      <Sheet
        open={!!configureApp}
        onClose={() => setConfigureApp(null)}
        title={configureApp ? `Configure ${configureApp.name}` : 'Configure'}
      >
        {configureApp && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste this webhook URL in {configureApp.name}&apos;s settings to receive events from
              BlinkOne. Connection status reflects your Chatwoot account configuration.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Endpoint URL</Label>
              <div className="flex gap-2">
                <Input readOnly value={endpointUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copyUrl} aria-label="Copy URL">
                  <Copy size={14} />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {connected.has(configureApp.id)
                ? 'This integration is enabled in Chatwoot. Disable it from the Chatwoot super admin or integrations panel.'
                : 'Enable this app in your Chatwoot administrator panel, then refresh this page.'}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
