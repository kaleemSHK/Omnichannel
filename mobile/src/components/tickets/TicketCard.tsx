import { View, Text, TouchableOpacity } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import type { Ticket } from '@/types';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';

interface TicketCardProps {
  ticket: Ticket;
  onPress: () => void;
}

export function TicketCard({ ticket, onPress }: TicketCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-card border border-surface-border rounded-xl p-4 active:opacity-70"
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-text-primary font-bold flex-1 mr-2" numberOfLines={2}>
          {ticket.subject}
        </Text>
        <PriorityBadge priority={ticket.priority} />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-text-secondary text-xs capitalize">{ticket.status}</Text>
        <Text className="text-text-muted text-xs">
          {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
