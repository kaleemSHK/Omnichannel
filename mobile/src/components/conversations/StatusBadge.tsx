import { Text, View } from 'react-native';
import { C } from '@/lib/ui';
import type { CWConversation } from '@/types';

const ST: Record<string, { bg: string; color: string; label: string }> = {
  open:     { bg: C.greenBg,   color: C.green,   label: 'Open' },
  resolved: { bg: C.bgMuted,   color: C.textMute, label: 'Resolved' },
  pending:  { bg: C.amberBg,   color: C.amber,   label: 'Pending' },
  snoozed:  { bg: '#EFF6FF',   color: C.brand,   label: 'Snoozed' },
};

export function StatusBadge({ status }: { status: CWConversation['status'] }) {
  const cfg = ST[status] ?? ST.resolved;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: cfg.bg }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}
