import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Animated } from 'react-native';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { hapticImpact, hapticSelection } from '@/lib/haptics';

const QUICK_REPLIES = [
  'Thank you for contacting us! How can I help you today?',
  'I understand your concern. Let me look into this for you.',
  'I apologize for the inconvenience. I will resolve this shortly.',
  'Could you please provide more details about the issue?',
];

interface Props {
  onSend: (text: string) => Promise<unknown> | void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const { t } = useTranslation();
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
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <View className="border-t border-surface-border bg-bg">
      {/* Quick replies */}
      {showQuick && (
        <View className="px-3 pt-2 pb-1 gap-1.5">
          {QUICK_REPLIES.map((reply) => (
            <TouchableOpacity
              key={reply}
              onPress={() => { setText(reply); setShowQuick(false); }}
              className="bg-surface-card border border-surface-border rounded-xl px-3 py-2"
            >
              <Text className="text-text-secondary text-xs" numberOfLines={1}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View className="flex-row items-end gap-2 px-3 py-2.5">
        {/* Quick reply button */}
        <TouchableOpacity
          onPress={() => { hapticSelection(); setShowQuick(v => !v); }}
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: showQuick ? 'rgba(99,179,237,0.2)' : 'rgba(255,255,255,0.06)' }}
        >
          <Text style={{ fontSize: 16 }}>⚡</Text>
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('conv.type_message')}
          placeholderTextColor="#5a6170"
          multiline
          style={{
            flex: 1,
            backgroundColor: '#22263a',
            borderWidth: 1,
            borderColor: canSend ? 'rgba(99,179,237,0.4)' : 'rgba(255,255,255,0.08)',
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 10,
            color: '#e8eaf0',
            fontSize: 14,
            maxHeight: 120,
            lineHeight: 20,
          }}
          editable={!disabled && !sending}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Send button */}
        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend || sending || disabled}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: canSend ? '#2563eb' : 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 18, color: canSend ? '#fff' : '#5a6170' }}>↑</Text>}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
