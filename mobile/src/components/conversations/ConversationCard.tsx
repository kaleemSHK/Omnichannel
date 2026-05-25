import { View, Text, TouchableOpacity } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import type { CWConversation } from '@/types';
import { Avatar } from '@/components/layout/Avatar';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/conversations/StatusBadge';

interface ConversationCardProps {
  conversation: CWConversation;
  onPress: () => void;
}

export function ConversationCard({ conversation, onPress }: ConversationCardProps) {
  const sender = conversation.meta.sender;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-card border border-surface-border rounded-xl p-4 flex-row items-center active:opacity-70"
    >
      <Avatar name={sender.name} imageUrl={sender.avatar} size={44} />
      <View className="flex-1 ml-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-text-primary font-bold flex-1 mr-2" numberOfLines={1}>
            {sender.name}
          </Text>
          <Text className="text-text-muted text-xs">
            {formatDistanceToNow(conversation.last_activity_at * 1000, { addSuffix: true })}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <StatusBadge status={conversation.status} />
          {conversation.unread_count > 0 ? <Badge count={conversation.unread_count} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
