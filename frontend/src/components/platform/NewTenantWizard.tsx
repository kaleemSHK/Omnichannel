'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import {
  PLATFORM_FEATURE_FLAGS,
  defaultFeatures,
  planLabel,
  slugFromName,
  type PlatformFeatureKey,
  type PlatformTenantView,
} from '@/lib/utils/platform';
import { useCreatePlatformTenant } from '@/lib/hooks/usePlatform';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PLANS: PlatformTenantView['plan'][] = ['starter', 'pro', 'enterprise'];

export function NewTenantWizard({ open, onClose }: Props) {
  const create = useCreatePlatformTenant();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState<PlatformTenantView['plan']>('starter');
  const [adminEmail, setAdminEmail] = useState('');
  const [features, setFeatures] = useState(defaultFeatures());

  useEffect(() => {
    if (!slugTouched && name) setSlug(slugFromName(name));
  }, [name, slugTouched]);

  const reset = () => {
    setStep(1);
    setName('');
    setSlug('');
    setSlugTouched(false);
    setPlan('starter');
    setAdminEmail('');
    setFeatures(defaultFeatures());
  };

  const toggleFeature = (key: PlatformFeatureKey) => {
    setFeatures(f => ({ ...f, [key]: !f[key] }));
  };

  const canNext =
    step === 1 ? name.trim().length >= 2 && slug.trim().length >= 2 && adminEmail.includes('@') : true;

  const submit = async () => {
    await create.mutateAsync({
      name: name.trim(),
      slug: slug.trim(),
      plan,
      adminEmail: adminEmail.trim(),
      features,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="New tenant" className="max-w-lg">
      <p className="text-xs text-gray-500 mb-4">Step {step} of 3</p>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Tenant name">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              placeholder="Acme Contact Center"
            />
          </Field>
          <Field label="Slug">
            <input
              value={slug}
              onChange={e => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono"
              placeholder="acme-cc"
            />
          </Field>
          <Field label="Plan">
            <select
              value={plan}
              onChange={e => setPlan(e.target.value as PlatformTenantView['plan'])}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            >
              {PLANS.map(p => (
                <option key={p} value={p}>
                  {planLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Admin email">
            <input
              type="email"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              placeholder="admin@acme.com"
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 mb-3">Enable features for this tenant.</p>
          {PLATFORM_FEATURE_FLAGS.map(flag => (
            <label key={flag.key} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={features[flag.key]}
                onChange={() => toggleFeature(flag.key)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-800">{flag.label}</span>
            </label>
          ))}
        </div>
      )}

      {step === 3 && (
        <dl className="space-y-2 text-sm">
          <Row label="Name" value={name} />
          <Row label="Slug" value={slug} />
          <Row label="Plan" value={planLabel(plan)} />
          <Row label="Admin" value={adminEmail} />
          <div>
            <dt className="text-gray-500">Features</dt>
            <dd className="text-gray-900 mt-1">
              {PLATFORM_FEATURE_FLAGS.filter(f => features[f.key])
                .map(f => f.label)
                .join(', ') || 'None'}
            </dd>
          </div>
        </dl>
      )}

      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
        >
          {step > 1 ? 'Back' : 'Cancel'}
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-md text-white',
              canNext ? 'bg-[#0B5FFF] hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed',
            )}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="px-4 py-1.5 text-sm bg-[#0B5FFF] text-white rounded-md hover:bg-blue-700 inline-flex items-center gap-2"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Create tenant
          </button>
        )}
      </div>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  );
}
