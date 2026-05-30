import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Ticket } from '@/types';
import { C } from '@/lib/ui';

type PriorityColors = { bg: string; text: string };

const COLORS: Record<Ticket['priority'], PriorityColors> = {
  p1: { bg: C.redBg, text: C.red },
  p2: { bg: C.amberBg, text: C.amber },
  p3: { bg: C.brandLight, text: C.brand },
  p4: { bg: C.bgMuted, text: C.textMute },
};

export function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const { t } = useTranslation();
  const colors = COLORS[priority] ?? COLORS.p4;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{t(`ticket.${priority}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
