import { View, Text, Image, StyleSheet } from 'react-native';
import type { CWMessage } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { C } from '@/lib/ui';

interface Props { message: CWMessage; isOwn?: boolean; showSender?: boolean; }

function ActivityLine({ message }: { message: CWMessage }) {
  return (
    <View style={s.actWrap}>
      <View style={s.actPill}><Text style={s.actText}>{message.content}</Text></View>
    </View>
  );
}

export function MessageBubble({ message, isOwn, showSender = true }: Props) {
  if (message.message_type === 2) return <ActivityLine message={message} />;
  const outgoing = isOwn ?? message.message_type === 1;
  const attachments: Array<{ thumb_url?: string; file_type?: string; data_url?: string }> = message.attachments ?? [];

  return (
    <View style={[s.wrap, outgoing ? s.wrapOut : s.wrapIn]}>
      {!outgoing && showSender && message.sender?.name && (
        <Text style={s.sender}>{message.sender.name}</Text>
      )}
      <View style={[s.bubble, outgoing ? s.bubbleOut : s.bubbleIn]}>
        {attachments.map((att, i) =>
          att.file_type?.startsWith('image') ? (
            <Image key={i} source={{ uri: att.thumb_url ?? att.data_url }}
              style={s.img} resizeMode="cover" />
          ) : (
            <View key={i} style={s.fileRow}>
              <Text>📎</Text>
              <Text style={s.fileText} numberOfLines={1}>{att.data_url?.split('/').pop() ?? 'Attachment'}</Text>
            </View>
          )
        )}
        {!!message.content && (
          <Text style={outgoing ? s.textOut : s.textIn}>{message.content}</Text>
        )}
      </View>
      <View style={[s.meta, outgoing && s.metaOut]}>
        <Text style={s.time}>{formatDistanceToNow(message.created_at * 1000, { addSuffix: true })}</Text>
        {outgoing && <Text style={s.receipt}>✓✓</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { marginBottom: 6, maxWidth: '80%' },
  wrapOut:  { alignSelf: 'flex-end' },
  wrapIn:   { alignSelf: 'flex-start' },
  sender:   { color: C.textMute, fontSize: 11, marginBottom: 2, marginLeft: 12 },
  bubble:   { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOut:{ backgroundColor: C.brand, borderBottomRightRadius: 4 },
  bubbleIn: { backgroundColor: C.bgCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  textOut:  { color: '#fff', fontSize: 14, lineHeight: 20 },
  textIn:   { color: C.text, fontSize: 14, lineHeight: 20 },
  img:      { width: 200, height: 150, borderRadius: 10, marginBottom: 6 },
  fileRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 8, padding: 8 },
  fileText: { color: C.textSub, fontSize: 12, flex: 1 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginLeft: 4 },
  metaOut:  { justifyContent: 'flex-end', marginRight: 4 },
  time:     { color: C.textMute, fontSize: 10 },
  receipt:  { color: C.brand, fontSize: 10 },
  actWrap:  { alignItems: 'center', marginVertical: 8 },
  actPill:  { backgroundColor: C.bgMuted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  actText:  { color: C.textMute, fontSize: 11 },
});
