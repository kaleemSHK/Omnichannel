import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { CWConversation } from '@/types';
import { Avatar } from '@/components/layout/Avatar';
import { Badge } from '@/components/ui/Badge';
import { C } from '@/lib/ui';

interface Props { conversation: CWConversation; onPress: () => void; sentiment?: 'positive' | 'neutral' | 'negative'; }

const CHANNEL_ICONS: Record<string, string> = { web_widget: '💬', api: '🔗', email: '📧', twitter: '🐦', facebook: '📘', whatsapp: '📱', sms: '💬', voice: '📞' };
const STATUS_CONFIG = { open: { color: C.green, label: 'Open' }, resolved: { color: C.brand, label: 'Resolved' }, pending: { color: C.amber, label: 'Pending' } } as const;
const SENTIMENT_COLOR = { positive: C.green, negative: C.red, neutral: 'transparent' };

export function ConversationCard({ conversation, onPress, sentiment }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const sender = conversation.meta.sender;
  const channelIcon = CHANNEL_ICONS[conversation.channel ?? 'web_widget'] ?? '💬';
  const status = STATUS_CONFIG[conversation.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
  const lastMsg = formatDistanceToNow(conversation.last_activity_at * 1000, { addSuffix: true });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
        style={s.card}>
        <View style={s.row}>
          {/* Avatar + channel badge */}
          <View style={{ position: 'relative' }}>
            <Avatar name={sender.name} imageUrl={sender.avatar} size={46} online={conversation.status === 'open'} />
            <View style={s.chBadge}><Text style={{ fontSize: 10 }}>{channelIcon}</Text></View>
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            {/* Name + time + unread */}
            <View style={[s.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
              <View style={[s.row, { flex: 1, gap: 6, marginRight: 8 }]}>
                <Text style={s.name} numberOfLines={1}>{sender.name}</Text>
                {sentiment && sentiment !== 'neutral' && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SENTIMENT_COLOR[sentiment] }} />
                )}
              </View>
              <View style={[s.row, { gap: 6 }]}>
                <Text style={s.time}>{lastMsg}</Text>
                {conversation.unread_count > 0 && <Badge count={conversation.unread_count} />}
              </View>
            </View>

            {/* Snippet */}
            <Text style={s.snippet} numberOfLines={1}>
              {`${sender.name} · #${conversation.id}`}
            </Text>

            {/* Status + labels + assignee */}
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <View style={[s.row, { gap: 6 }]}>
                <View style={[s.pill, { backgroundColor: status.color + '22' }]}>
                  <Text style={{ color: status.color, fontSize: 10, fontWeight: '600' }}>{status.label}</Text>
                </View>
                {(conversation.labels ?? []).slice(0, 2).map((label: string) => (
                  <View key={label} style={[s.pill, { backgroundColor: C.bgMuted, borderWidth: 1, borderColor: C.border }]}>
                    <Text style={{ color: C.textMute, fontSize: 10 }}>{label}</Text>
                  </View>
                ))}
              </View>
              {conversation.meta?.assignee && <Avatar name={conversation.meta.assignee.name} size={18} />}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card:    { backgroundColor: C.bgCard, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  chBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  name:    { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  time:    { fontSize: 11, color: C.textMute },
  snippet: { fontSize: 12, color: C.textSub, marginBottom: 6 },
  pill:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
});
