import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { CWConversation } from '@/types';
import { Avatar } from '@/components/layout/Avatar';
import { Badge } from '@/components/ui/Badge';

interface ConversationCardProps {
  conversation: CWConversation;
  onPress: () => void;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

const CHANNEL_ICONS: Record<string, string> = {
  web_widget: '💬', api: '🔗', email: '📧', twitter: '🐦',
  facebook: '📘', whatsapp: '📱', sms: '💬', voice: '📞',
};

const STATUS_CONFIG = {
  open:     { color: '#48bb78', label: 'Open' },
  resolved: { color: '#63b3ed', label: 'Resolved' },
  pending:  { color: '#f6ad55', label: 'Pending' },
} as const;

const SENTIMENT_COLOR = { positive: '#48bb78', negative: '#fc8181', neutral: 'transparent' };

export function ConversationCard({ conversation, onPress, sentiment }: ConversationCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const sender = conversation.meta.sender;
  const channelIcon = CHANNEL_ICONS[conversation.channel ?? 'web_widget'] ?? '💬';
  const status = STATUS_CONFIG[conversation.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
  const lastMsg = formatDistanceToNow(
    conversation.last_activity_at * 1000,
    { addSuffix: true },
  );

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        className="bg-surface-card border border-surface-border rounded-2xl p-4"
      >
        <View className="flex-row items-start gap-3">
          {/* Avatar + channel badge */}
          <View className="relative">
            <Avatar name={sender.name} imageUrl={sender.avatar} size={46} online={conversation.status === 'open'} />
            <View className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface items-center justify-center border border-surface-border">
              <Text style={{ fontSize: 10 }}>{channelIcon}</Text>
            </View>
          </View>

          <View className="flex-1">
            {/* Name + time + unread */}
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Text className="text-text-primary font-bold text-sm flex-1" numberOfLines={1}>
                  {sender.name}
                </Text>
                {sentiment && sentiment !== 'neutral' && (
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: SENTIMENT_COLOR[sentiment] }} />
                )}
              </View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-text-muted text-xs">{lastMsg}</Text>
                {conversation.unread_count > 0 && <Badge count={conversation.unread_count} />}
              </View>
            </View>

            {/* Last message snippet */}
            <Text className="text-text-secondary text-xs mb-2" numberOfLines={1}>
              {conversation.meta?.sender?.name
                ? `${sender.name} · #${conversation.id}`
                : 'New conversation'}
            </Text>

            {/* Status + labels + assignee */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: status.color + '22' }}>
                  <Text style={{ color: status.color, fontSize: 10, fontWeight: '600' }}>{status.label}</Text>
                </View>
                {(conversation.labels ?? []).slice(0, 2).map((label: string) => (
                  <View key={label} className="px-2 py-0.5 rounded-full bg-surface border border-surface-border">
                    <Text className="text-text-muted" style={{ fontSize: 10 }}>{label}</Text>
                  </View>
                ))}
              </View>
              {conversation.meta?.assignee && (
                <Avatar name={conversation.meta.assignee.name} size={18} />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
