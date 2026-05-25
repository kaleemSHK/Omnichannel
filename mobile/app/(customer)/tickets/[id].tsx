import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@/components/layout/AppHeader';
import { getTicket } from '@/api/tickets';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDistanceToNow } from 'date-fns';

export default function CustomerTicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(String(id)),
    enabled: !!id,
  });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title={ticket?.subject ?? 'Ticket'} />
      {isLoading || !ticket ? (
        <View className="p-5">
          <Skeleton className="h-32 rounded-xl" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 py-4">
          <View className="flex-row items-center gap-2 mb-4">
            <PriorityBadge priority={ticket.priority} />
            <Text className="text-text-secondary text-sm capitalize">{ticket.status}</Text>
          </View>
          <Text className="text-text-primary text-xl font-bold mb-2">{ticket.subject}</Text>
          <Text className="text-text-muted text-xs mb-6">
            Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
          </Text>
          <View className="bg-surface-card border border-surface-border rounded-xl p-4">
            <Text className="text-text-secondary text-sm">
              Ticket #{ticket.id.slice(0, 8)} — contact support for updates.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
