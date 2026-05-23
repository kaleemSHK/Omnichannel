'use client';

import Link from 'next/link';
import { CountdownBar } from '@/components/sla/CountdownBar';
import {
  formatDeadline,
  formatRemaining,
  statusChipClass,
  tierBadgeClass,
} from '@/lib/utils/sla';
import { uiStatusLabel } from '@/lib/hooks/useSla';
import { cn } from '@/lib/utils/cn';
import type { SlaInstanceView } from '@/lib/demo/slaFixture';

export function SLAInstanceRow({ instance }: { instance: SlaInstanceView }) {
  const border =
    instance.uiStatus === 'breached'
      ? 'border-s-4 border-red-500'
      : instance.uiStatus === 'at_risk'
        ? 'border-s-4 border-amber-400'
        : 'border-s-transparent';

  const remainingTone =
    instance.uiStatus === 'breached'
      ? 'text-red-600'
      : instance.uiStatus === 'at_risk'
        ? 'text-amber-600'
        : instance.uiStatus === 'active'
          ? 'text-green-700'
          : 'text-gray-400';

  const assignee = instance.assignee ?? 'Unassigned';
  const assigneeTone =
    instance.uiStatus === 'breached' && !instance.assignee ? 'text-red-600' : 'text-gray-700';

  return (
    <tr className={cn('border-b border-gray-50 hover:bg-gray-50/80', border)}>
      <td className="px-3 py-2.5">
        <Link
          href={`/conversations?id=${instance.conversationId}`}
          className="text-sm font-mono text-[#0B5FFF] hover:underline"
        >
          #{instance.conversationId}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium text-gray-900">{instance.contact?.name}</p>
        <p className="text-xs text-gray-500 truncate max-w-[200px]">{instance.subject}</p>
      </td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs capitalize',
            tierBadgeClass(instance.tier ?? instance.contact?.tier),
          )}
        >
          {instance.tier ?? instance.contact?.tier ?? 'silver'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn('px-2 py-0.5 rounded-full text-xs', statusChipClass(instance.uiStatus))}>
          {uiStatusLabel(instance.uiStatus)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-600 tabular-nums">
        {formatDeadline(instance.dueAt ?? instance.resolutionDeadline)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-col gap-1">
          {instance.uiStatus === 'at_risk' && (
            <CountdownBar
              elapsedSeconds={instance.elapsedSeconds ?? 0}
              totalSeconds={instance.totalSeconds ?? 1}
            />
          )}
          <span className={cn('text-xs tabular-nums', remainingTone)}>{formatRemaining(instance)}</span>
        </div>
      </td>
      <td className={cn('px-3 py-2.5 text-sm', assigneeTone)}>{assignee}</td>
    </tr>
  );
}
