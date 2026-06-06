import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useState } from 'react';
import { hapticImpact } from '@/lib/haptics';
import { C } from '@/lib/ui';

interface Props {
  onSend: (text: string) => Promise<unknown> | void;
  disabled?: boolean;
  placeholder?: string;
}

export function CustomerMessageInput({
  onSend,
  disabled,
  placeholder = 'Type your message…',
}: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const canSend = text.trim().length > 0;

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    hapticImpact('light');
    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={C.textMute}
          multiline
          style={s.input}
          editable={!disabled && !sending}
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend || sending || disabled}
          style={[s.sendBtn, canSend ? s.sendBtnOn : s.sendBtnOff]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[s.sendIcon, !canSend && s.sendIconOff]}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
      <Text style={s.hint}>Our team typically replies within a few minutes</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bgCard,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: C.bgMuted,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: C.text,
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 21,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOn: { backgroundColor: C.brand },
  sendBtnOff: { backgroundColor: C.bgMuted },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sendIconOff: { color: C.textMute },
  hint: {
    marginTop: 8,
    textAlign: 'center',
    color: C.textMute,
    fontSize: 11,
  },
});
