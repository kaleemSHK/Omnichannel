'use client';

/**
 * CRM & ERP Connectors Panel — Sprint 3 C1
 * Manage Salesforce, Dynamics 365, and Generic REST connector integrations.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlusCircle, Trash2, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { SectionHeader } from './shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/Sheet';
import {
  listConnectors,
  upsertConnector,
  deleteConnector,
  testConnector,
  type ConnectorRecord,
  type ConnectorType,
  type ConnectorUpsertPayload,
} from '@/lib/api/connectors';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useTenantId } from '@/lib/hooks/useTenantScope';

// ─── Demo data ──────────────────────────────────────────────────────────────

const DEMO_CONNECTORS: ConnectorRecord[] = [
  {
    id: 'demo-sf',
    connectorType: 'salesforce',
    name: 'Salesforce (Prod)',
    status: 'connected',
    config: { instanceUrl: 'https://acme.salesforce.com' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-d365',
    connectorType: 'microsoft_dynamics',
    name: 'Dynamics 365',
    status: 'disconnected',
    config: { resourceUrl: 'https://acme.crm.dynamics.com' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── Connector type metadata ─────────────────────────────────────────────────

interface ConnectorMeta {
  label: string;
  description: string;
  fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean }>;
}

const CONNECTOR_TYPES: Record<ConnectorType, ConnectorMeta> = {
  salesforce: {
    label: 'Salesforce',
    description: 'Salesforce CRM — OAuth2 username/password flow, REST API v59',
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://myorg.salesforce.com' },
      { key: 'clientId', label: 'Client ID', placeholder: 'Connected app client ID' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '…', secret: true },
      { key: 'username', label: 'Username', placeholder: 'user@example.com' },
      { key: 'password', label: 'Password', placeholder: '…', secret: true },
      { key: 'securityToken', label: 'Security Token (optional)', placeholder: 'IP-restricted orgs only' },
    ],
  },
  microsoft_dynamics: {
    label: 'Microsoft Dynamics 365',
    description: 'AAD client-credentials flow, OData v9.2',
    fields: [
      { key: 'aadTenantId', label: 'AAD Tenant ID', placeholder: 'Azure AD tenant GUID' },
      { key: 'clientId', label: 'Client ID', placeholder: 'App registration client ID' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '…', secret: true },
      { key: 'resourceUrl', label: 'Resource URL', placeholder: 'https://myorg.crm.dynamics.com' },
    ],
  },
  generic_rest: {
    label: 'Generic REST',
    description: 'Map BlinkOne events to any HTTP endpoint',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://erp.example.com/api' },
      { key: 'authType', label: 'Auth Type', placeholder: 'bearer | basic | api_key | none' },
      { key: 'authValue', label: 'Auth Value / Token', placeholder: 'Your API token or key', secret: true },
    ],
  },
  sap_b1: {
    label: 'SAP Business One',
    description: 'SAP B1 Service Layer connector (spec TBD)',
    fields: [
      { key: 'serviceLayerUrl', label: 'Service Layer URL', placeholder: 'https://sap-host:50000/b1s/v1' },
      { key: 'companyDb', label: 'Company DB', placeholder: 'SBODEMOGB' },
      { key: 'username', label: 'Username', placeholder: 'manager' },
      { key: 'password', label: 'Password', placeholder: '…', secret: true },
    ],
  },
  oracle_fusion: {
    label: 'Oracle Fusion',
    description: 'Oracle Fusion Cloud ERP REST APIs',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://mycompany.fa.oraclecloud.com' },
      { key: 'username', label: 'Username', placeholder: 'fusion.user@example.com' },
      { key: 'password', label: 'Password', placeholder: '…', secret: true },
    ],
  },
  tasdeeq: {
    label: 'Tasdeeq',
    description: 'Pakistan credit bureau integration (connector spec TBD)',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: '…', secret: true },
    ],
  },
};

const STATUS_BADGE: Record<ConnectorRecord['status'], { label: string; className: string }> = {
  connected:    { label: 'Connected',    className: 'text-green-700 border-green-300 bg-green-50' },
  disconnected: { label: 'Disconnected', className: 'text-muted-foreground' },
  error:        { label: 'Error',        className: 'text-red-700 border-red-300 bg-red-50' },
  pending:      { label: 'Pending',      className: 'text-yellow-700 border-yellow-300 bg-yellow-50' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CRMConnectorsPanel() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ConnectorType>('salesforce');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [connectorName, setConnectorName] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  // ─── List query ────────────────────────────────────────────────────────────
  const { data: connectors = [], isLoading } = useQuery({
    queryKey: ['crm-connectors', tenantId],
    queryFn: () => {
      if (isDemoDataEnabled()) return DEMO_CONNECTORS;
      return listConnectors();
    },
    staleTime: 60_000,
  });

  // ─── Upsert mutation ───────────────────────────────────────────────────────
  const upsertMut = useMutation({
    mutationFn: (payload: ConnectorUpsertPayload) => upsertConnector(payload),
    onSuccess: () => {
      toast.success('Connector saved');
      void qc.invalidateQueries({ queryKey: ['crm-connectors', tenantId] });
      setAddOpen(false);
      setFormValues({});
      setConnectorName('');
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });

  // ─── Delete mutation ───────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteConnector(id),
    onSuccess: () => {
      toast.success('Connector removed');
      void qc.invalidateQueries({ queryKey: ['crm-connectors', tenantId] });
    },
    onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
  });

  // ─── Test handler ──────────────────────────────────────────────────────────
  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const result = await testConnector(id);
      if (result.ok) {
        toast.success(`Health check passed${result.latencyMs != null ? ` (${result.latencyMs}ms)` : ''}`);
      } else {
        toast.error(`Health check failed: ${result.detail ?? 'unknown'}`);
      }
    } catch {
      toast.error('Health check request failed');
    } finally {
      setTestingId(null);
    }
  }

  // ─── Form submit ───────────────────────────────────────────────────────────
  function handleSave() {
    if (!connectorName.trim()) {
      toast.error('Connector name is required');
      return;
    }
    upsertMut.mutate({
      connectorType: selectedType,
      name: connectorName.trim(),
      config: formValues,
    });
  }

  const typeMeta = CONNECTOR_TYPES[selectedType];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="CRM & ERP Connectors"
        description="Connect Salesforce, Dynamics 365, or any REST endpoint for real-time contact lookups and case creation."
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-1.5" />
          Add connector
        </Button>
      </div>

      {/* Connector list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading connectors…
        </div>
      ) : connectors.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No connectors configured yet. Click <strong>Add connector</strong> to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {connectors.map(c => {
            const badge = STATUS_BADGE[c.status];
            const isTesting = testingId === c.id;
            return (
              <article key={c.id} className="border rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{c.name}</span>
                    <Badge variant="outline" className={`${badge.className} shrink-0`}>
                      {badge.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CONNECTOR_TYPES[c.connectorType]?.label ?? c.connectorType}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(c.id)}
                    disabled={isTesting}
                    aria-label="Test connection"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : c.status === 'connected' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    <span className="ml-1 hidden sm:inline">Test</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMut.mutate(c.id)}
                    disabled={deleteMut.isPending}
                    aria-label="Remove connector"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add connector sheet */}
      <Sheet
        open={addOpen}
        onClose={() => { setAddOpen(false); setFormValues({}); setConnectorName(''); }}
        title="Add CRM / ERP Connector"
      >
        <div className="space-y-4">
          {/* Connector type picker */}
          <div className="space-y-1">
            <Label className="text-xs">Connector type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CONNECTOR_TYPES) as ConnectorType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setSelectedType(t); setFormValues({}); }}
                  className={`border rounded-md px-3 py-2 text-xs text-left transition-colors ${
                    selectedType === t
                      ? 'border-brand-primary bg-brand-primary/5 font-semibold'
                      : 'hover:bg-muted'
                  }`}
                >
                  {CONNECTOR_TYPES[t].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">{typeMeta.description}</p>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="connector-name" className="text-xs">Connector name</Label>
            <Input
              id="connector-name"
              placeholder={`e.g. ${typeMeta.label} (Production)`}
              value={connectorName}
              onChange={e => setConnectorName(e.target.value)}
            />
          </div>

          {/* Dynamic fields */}
          {typeMeta.fields.map(f => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`field-${f.key}`} className="text-xs">{f.label}</Label>
              <Input
                id={`field-${f.key}`}
                type={f.secret ? 'password' : 'text'}
                placeholder={f.placeholder}
                value={formValues[f.key] ?? ''}
                onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                autoComplete={f.secret ? 'new-password' : undefined}
              />
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={upsertMut.isPending}
            >
              {upsertMut.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
              ) : (
                'Save connector'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setAddOpen(false); setFormValues({}); setConnectorName(''); }}
            >
              Cancel
            </Button>
          </div>

          {upsertMut.isError && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <XCircle className="w-3.5 h-3.5" />
              {(upsertMut.error as Error)?.message}
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
