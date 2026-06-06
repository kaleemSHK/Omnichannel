import { View, Text, Image, StyleSheet } from 'react-native';
import type { CWMessage } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { resolveMessageSender } from '@/lib/message-sender';
import { C } from '@/lib/ui';

interface Props {
  message: CWMessage;
  /** Customer app: own messages on the right. Agent app: agent messages on the right. */
  viewer?: 'customer' | 'agent';
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function ActivityLine({ message }: { message: CWMessage }) {
  return (
    <View style={s.actWrap}>
      <View style={s.actPill}>
        <Text style={s.actText}>{message.content.replace(/<[^>]+>/g, '')}</Text>
      </View>
    </View>
  );
}

export function MessageBubble({ message, viewer = 'customer' }: Props) {
  if (message.message_type === 2) return <ActivityLine message={message} />;

  const fromCustomer = resolveMessageSender(message) === 'customer';
  const isOwn = viewer === 'customer' ? fromCustomer : !fromCustomer;
  const senderName = message.sender?.name ?? (fromCustomer ? 'You' : 'Support Agent');
  const attachments: Array<{ thumb_url?: string; file_type?: string; data_url?: string }> =
    message.attachments ?? [];

  return (
    <View style={[s.row, isOwn ? s.rowOwn : s.rowOther]}>
      {!isOwn && (
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials(senderName)}</Text>
        </View>
      )}
      <View style={[s.stack, isOwn ? s.stackOwn : s.stackOther]}>
        {!isOwn && <Text style={s.sender}>{senderName}</Text>}
        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
          {attachments.map((att, i) =>
            att.file_type?.startsWith('image') ? (
              <Image
                key={i}
                source={{ uri: att.thumb_url ?? att.data_url }}
                style={s.img}
                resizeMode="cover"
              />
            ) : (
              <View key={i} style={s.fileRow}>
                <Text>📎</Text>
                <Text style={s.fileText} numberOfLines={1}>
                  {att.data_url?.split('/').pop() ?? 'Attachment'}
                </Text>
              </View>
            ),
          )}
          {!!message.content && (
            <Text style={isOwn ? s.textOwn : s.textOther}>{message.content}</Text>
          )}
        </View>
        <View style={[s.meta, isOwn && s.metaOwn]}>
          <Text style={s.time}>
            {formatDistanceToNow(message.created_at * 1000, { addSuffix: true })}
          </Text>
          {isOwn && <Text style={s.receipt}>✓✓</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 14, maxWidth: '88%' },
  rowOwn: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  rowOther: { alignSelf: 'flex-start' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.bgBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 18,
  },
  avatarText: { color: C.brand, fontSize: 12, fontWeight: '700' },
  stack: { flexShrink: 1 },
  stackOwn: { alignItems: 'flex-end' },
  stackOther: { alignItems: 'flex-start' },
  sender: { color: C.textMute, fontSize: 11, fontWeight: '600', marginBottom: 4, marginLeft: 4 },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
    ...C.shadow,
  },
  bubbleOwn: {
    backgroundColor: C.brand,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: C.bgCard,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  textOwn: { color: '#fff', fontSize: 15, lineHeight: 22 },
  textOther: { color: C.text, fontSize: 15, lineHeight: 22 },
  img: { width: 220, height: 160, borderRadius: 12, marginBottom: 8 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 8,
  },
  fileText: { color: C.textSub, fontSize: 12, flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 4 },
  metaOwn: { justifyContent: 'flex-end', marginRight: 4 },
  time: { color: C.textMute, fontSize: 10 },
  receipt: { color: C.brand, fontSize: 10, fontWeight: '700' },
  actWrap: { alignItems: 'center', marginVertical: 10 },
  actPill: {
    backgroundColor: C.bgMuted,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  actText: { color: C.textMute, fontSize: 11, textAlign: 'center' },
});
