import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { useState, useRef } from 'react';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { C } from '@/lib/ui';

const QUICK_REPLIES = [
  'Thank you for contacting us! How can I help you today?',
  'I understand your concern. Let me look into this for you.',
  'I apologize for the inconvenience. I will resolve this shortly.',
  'Could you please provide more details about the issue?',
];

interface Props { onSend: (text: string) => Promise<unknown> | void; disabled?: boolean; }

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const sendScale = useRef(new Animated.Value(1)).current;
  const canSend = text.trim().length > 0;

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    hapticImpact('light');
    Animated.sequence([
      Animated.spring(sendScale, { toValue: 0.85, useNativeDriver: true, speed: 60 }),
      Animated.spring(sendScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    setSending(true);
    try { await onSend(trimmed); setText(''); } finally { setSending(false); }
  }

  return (
    <View style={s.wrap}>
      {showQuick && (
        <View style={s.quickList}>
          {QUICK_REPLIES.map((reply) => (
            <TouchableOpacity key={reply} onPress={() => { setText(reply); setShowQuick(false); }} style={s.quickItem}>
              <Text style={s.quickText} numberOfLines={1}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={s.row}>
        <TouchableOpacity onPress={() => { hapticSelection(); setShowQuick(v => !v); }}
          style={[s.quickBtn, showQuick && s.quickBtnOn]}>
          <Text style={{ fontSize: 16 }}>⚡</Text>
        </TouchableOpacity>
        <TextInput value={text} onChangeText={setText} placeholder="Type a message…"
          placeholderTextColor={C.textMute} multiline
          style={[s.input, canSend && s.inputActive]}
          editable={!disabled && !sending} returnKeyType="default" blurOnSubmit={false} />
        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <TouchableOpacity onPress={handleSend} disabled={!canSend || sending || disabled}
            style={[s.sendBtn, canSend ? s.sendBtnOn : s.sendBtnOff]}>
            {sending ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 18, color: canSend ? '#fff' : C.textMute }}>↑</Text>}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgCard },
  quickList:  { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 6 },
  quickItem:  { backgroundColor: C.bgMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  quickText:  { color: C.textSub, fontSize: 13 },
  row:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  quickBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgMuted, alignItems: 'center', justifyContent: 'center' },
  quickBtnOn: { backgroundColor: C.brandLight ?? '#DBEAFE' },
  input:      { flex: 1, backgroundColor: C.bgMuted, borderWidth: 1.5, borderColor: C.border, borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, color: C.text, fontSize: 14, maxHeight: 120, lineHeight: 20 },
  inputActive:{ borderColor: C.brand },
  sendBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnOn:  { backgroundColor: C.brand },
  sendBtnOff: { backgroundColor: C.bgMuted },
});
