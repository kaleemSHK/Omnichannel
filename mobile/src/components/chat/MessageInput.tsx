import { View, TextInput, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MessageInputProps {
  onSend: (text: string) => Promise<unknown> | void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <View className="flex-row items-end gap-2 px-4 py-3 border-t border-surface-border bg-bg">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('conv.type_message')}
        placeholderTextColor="#5a6170"
        multiline
        className="flex-1 bg-surface-card border border-surface-border rounded-2xl px-4 py-2.5 text-text-primary max-h-28"
        editable={!disabled && !sending}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!text.trim() || sending || disabled}
        className="bg-brand rounded-full w-11 h-11 items-center justify-center active:opacity-80"
      >
        {sending ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Text className="text-black font-bold">{t('conv.send')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
