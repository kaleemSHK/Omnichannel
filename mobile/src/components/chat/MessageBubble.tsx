import { View, Text } from 'react-native';
import type { CWMessage } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface MessageBubbleProps {
  message: CWMessage;
  isOwn?: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const outgoing = isOwn ?? message.message_type === 1;

  return (
    <View className={`mb-2 max-w-[85%] ${outgoing ? 'self-end' : 'self-start'}`}>
      {!outgoing && message.sender?.name ? (
        <Text className="text-text-muted text-xs mb-1 ml-1">{message.sender.name}</Text>
      ) : null}
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          outgoing ? 'bg-brand rounded-br-sm' : 'bg-surface-card border border-surface-border rounded-bl-sm'
        }`}
      >
        <Text className={outgoing ? 'text-black' : 'text-text-primary'}>{message.content}</Text>
      </View>
      <Text className={`text-text-muted text-[10px] mt-1 ${outgoing ? 'text-right mr-1' : 'ml-1'}`}>
        {formatDistanceToNow(message.created_at * 1000, { addSuffix: true })}
      </Text>
    </View>
  );
}
