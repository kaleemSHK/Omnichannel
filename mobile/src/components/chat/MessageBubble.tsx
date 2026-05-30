import { View, Text, Image } from 'react-native';
import type { CWMessage } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface Props { message: CWMessage; isOwn?: boolean; showSender?: boolean; }

function ActivityLine({ message }: { message: CWMessage }) {
  return (
    <View className="items-center my-3">
      <View className="bg-surface border border-surface-border rounded-full px-3 py-1">
        <Text className="text-text-muted" style={{ fontSize: 11 }}>{message.content}</Text>
      </View>
    </View>
  );
}

export function MessageBubble({ message, isOwn, showSender = true }: Props) {
  if (message.message_type === 2) return <ActivityLine message={message} />;
  const outgoing = isOwn ?? message.message_type === 1;
  const attachments: Array<{ thumb_url?: string; file_type?: string; data_url?: string }> = message.attachments ?? [];

  return (
    <View className={`mb-1.5 max-w-[80%] ${outgoing ? 'self-end' : 'self-start'}`}>
      {!outgoing && showSender && message.sender?.name && (
        <Text className="text-text-muted ml-3 mb-0.5" style={{ fontSize: 11 }}>
          {message.sender.name}
        </Text>
      )}

      <View style={{
        backgroundColor: outgoing ? '#2563eb' : '#22263a',
        borderRadius: 18,
        borderBottomRightRadius: outgoing ? 4 : 18,
        borderBottomLeftRadius: outgoing ? 18 : 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: outgoing ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}>
        {attachments.map((att, i) =>
          att.file_type?.startsWith('image') ? (
            <Image key={i} source={{ uri: att.thumb_url ?? att.data_url }}
              style={{ width: 200, height: 150, borderRadius: 10, marginBottom: message.content ? 6 : 0 }}
              resizeMode="cover" />
          ) : (
            <View key={i} className="flex-row items-center gap-2 mb-1 rounded-lg p-2"
              style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <Text>📎</Text>
              <Text style={{ color: outgoing ? '#e0f0ff' : '#9099aa', fontSize: 12 }} numberOfLines={1}>
                {att.data_url?.split('/').pop() ?? 'Attachment'}
              </Text>
            </View>
          )
        )}
        {!!message.content && (
          <Text style={{ color: outgoing ? '#ffffff' : '#e8eaf0', fontSize: 14, lineHeight: 20 }}>
            {message.content}
          </Text>
        )}
      </View>

      <View className={`flex-row items-center mt-0.5 gap-1 ${outgoing ? 'justify-end mr-1' : 'ml-1'}`}>
        <Text className="text-text-muted" style={{ fontSize: 10 }}>
          {formatDistanceToNow(message.created_at * 1000, { addSuffix: true })}
        </Text>
        {outgoing && <Text style={{ fontSize: 10, color: '#63b3ed' }}>✓✓</Text>}
      </View>
    </View>
  );
}
