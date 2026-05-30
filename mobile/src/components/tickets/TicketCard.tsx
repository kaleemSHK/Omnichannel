import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import type { Ticket } from '@/types';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { C } from '@/lib/ui';

interface TicketCardProps {
  ticket: Ticket;
  onPress: () => void;
}

export function TicketCard({ ticket, onPress }: TicketCardProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <Text style={styles.subject} numberOfLines={2}>
          {ticket.subject}
        </Text>
        <PriorityBadge priority={ticket.priority} />
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.status}>{ticket.status}</Text>
        <Text style={styles.time}>
          {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subject: {
    color: C.text,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    color: C.textSub,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  time: {
    color: C.textMute,
    fontSize: 12,
  },
});
