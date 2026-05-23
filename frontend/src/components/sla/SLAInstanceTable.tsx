'use client';

import { Loader2 } from 'lucide-react';
import { SLAInstanceRow } from '@/components/sla/SLAInstanceRow';
import type { SlaInstanceView } from '@/lib/demo/slaFixture';

interface Props {
  instances: SlaInstanceView[];
  isLoading?: boolean;
}

export function SLAInstanceTable({ instances, isLoading }: Props) {
  return (
    <div className="bn-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Deadline</th>
              <th className="px-3 py-2 font-medium">Remaining</th>
              <th className="px-3 py-2 font-medium">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
                </td>
              </tr>
            )}
            {!isLoading && instances.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  No SLA instances in this view
                </td>
              </tr>
            )}
            {!isLoading && instances.map(i => <SLAInstanceRow key={i.id} instance={i} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
