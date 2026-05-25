import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Ticket } from '@/types';

const COLORS: Record<Ticket['priority'], string> = {
  p1: 'bg-danger/20 text-danger',
  p2: 'bg-warning/20 text-warning',
  p3: 'bg-brand/20 text-brand',
  p4: 'bg-text-muted/20 text-text-muted',
};

export function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const { t } = useTranslation();
  const [bg, text] = (COLORS[priority] ?? COLORS.p4).split(' ');

  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-semibold uppercase ${text}`}>{t(`ticket.${priority}`)}</Text>
    </View>
  );
}
