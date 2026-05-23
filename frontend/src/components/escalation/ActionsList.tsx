'use client';

import { Bell, Globe, MessageSquare, Tag, UserPlus } from 'lucide-react';
import { describeAction } from '@/lib/utils/escalation';
import { cn } from '@/lib/utils/cn';
import type { EscalationAction } from '@/types';

const ICONS = {
  reassign: UserPlus,
  notify: Bell,
  label: Tag,
  message: MessageSquare,
  webhook: Globe,
} as const;

const BADGE: Record<string, string> = {
  reassign: 'bg-blue-50 text-blue-700',
  notify: 'bg-amber-50 text-amber-700',
  label: 'bg-green-50 text-green-700',
  message: 'bg-purple-50 text-purple-700',
  webhook: 'bg-gray-100 text-gray-600',
};

export function ActionsList({ actions }: { actions: EscalationAction[] }) {
  if (!actions.length) {
    return <p className="text-sm text-gray-400">No actions configured</p>;
  }

  return (
    <ul className="space-y-2">
      {actions.map((action, i) => {
        const { label, icon } = describeAction(action);
        const Icon = ICONS[icon as keyof typeof ICONS] ?? Globe;
        return (
          <li key={`${action.type}-${i}`} className="flex items-center gap-2 text-sm text-gray-700">
            <span
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                BADGE[icon] ?? BADGE.webhook,
              )}
            >
              <Icon size={14} />
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
