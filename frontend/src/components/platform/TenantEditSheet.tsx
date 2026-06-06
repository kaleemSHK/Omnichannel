'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/button';
import { useUpdateTenant } from '@/lib/hooks/usePlatform';
import type { PlatformTenantView } from '@/lib/utils/platform';

interface Props {
  tenant: PlatformTenantView | null;
  open: boolean;
  onClose: () => void;
}

export function TenantEditSheet({ tenant, open, onClose }: Props) {
  const update = useUpdateTenant();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<PlatformTenantView['status']>('active');

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setStatus(tenant.status);
    }
  }, [tenant]);

  const save = () => {
    if (!tenant) return;
    update.mutate(
      { tenantId: tenant.id, patch: { name: name.trim(), status } },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Edit tenant">
      <div className="space-y-4 p-1">
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Status</span>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as PlatformTenantView['status'])}
            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending || !name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
