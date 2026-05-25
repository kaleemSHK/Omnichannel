import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CWConversation } from '@/types';

const COLORS: Record<CWConversation['status'], string> = {
  open: 'bg-success/20 text-success',
  resolved: 'bg-text-muted/20 text-text-muted',
  pending: 'bg-warning/20 text-warning',
  snoozed: 'bg-brand/20 text-brand',
};

export function StatusBadge({ status }: { status: CWConversation['status'] }) {
  const { t } = useTranslation();
  const label =
    status === 'snoozed' ? status : t(`conv.${status}` as 'conv.open' | 'conv.resolved' | 'conv.pending');

  return (
    <View className={`px-2 py-0.5 rounded-full ${COLORS[status]?.split(' ')[0] ?? 'bg-surface'}`}>
      <Text className={`text-xs font-medium ${COLORS[status]?.split(' ')[1] ?? 'text-text-secondary'}`}>
        {label}
      </Text>
    </View>
  );
}
