import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@/components/layout/AppHeader';
import { getTicket } from '@/api/tickets';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDistanceToNow } from 'date-fns';
import type { CustomerStackParamList } from '@/navigation/types';
import { C } from '@/lib/ui';

export default function CustomerTicketDetail() {
  const route = useRoute<RouteProp<CustomerStackParamList, 'TicketDetail'>>();
  const id = route.params.id;

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(String(id)),
    enabled: !!id,
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title={ticket?.subject ?? 'Ticket'} />
      {isLoading || !ticket ? (
        <View style={styles.skeletonContainer}>
          <Skeleton style={{ height: 128, borderRadius: 12 }} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.metaRow}>
            <PriorityBadge priority={ticket.priority} />
            <Text style={styles.status}>{ticket.status}</Text>
          </View>
          <Text style={styles.subject}>{ticket.subject}</Text>
          <Text style={styles.updated}>
            Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Ticket #{ticket.id.slice(0, 8)} — contact support for updates.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  skeletonContainer: {
    padding: 20,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  status: {
    color: C.textSub,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  subject: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  updated: {
    color: C.textMute,
    fontSize: 12,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    color: C.textSub,
    fontSize: 14,
  },
});
