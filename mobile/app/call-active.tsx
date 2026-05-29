import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync } from 'expo-audio';

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export default function CallActiveScreen() {
  const { t } = useTranslation();
  const activeCall = useCallsStore((s) => s.activeCall);
  const isMuted = useCallsStore((s) => s.isMuted);
  const isOnHold = useCallsStore((s) => s.isOnHold);
  const callDurationSec = useCallsStore((s) => s.callDurationSec);
  const { hangup, mute, unmute, hold, unhold } = useSip();
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showDtmf, setShowDtmf] = useState(false);
  const [dtmfPressed, setDtmfPressed] = useState('');

  useEffect(() => {
    if (!activeCall) router.back();
  }, [activeCall]);

  async function handleEndCall() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    hangup();
    router.back();
  }

  function handleMute() {
    Haptics.selectionAsync();
    if (isMuted) unmute();
    else mute();
  }

  async function handleHold() {
    Haptics.selectionAsync();
    if (isOnHold) await unhold();
    else await hold();
  }

  async function handleSpeaker() {
    Haptics.selectionAsync();
    const next = !isSpeaker;
    setIsSpeaker(next);
    try {
      await setAudioModeAsync({ allowsRecording: next });
    } catch {
      // Audio mode not critical
    }
  }

  function handleDtmf(digit: string) {
    Haptics.selectionAsync();
    setDtmfPressed((d) => d + digit);
    // JsSIP DTMF is sent via the session — dispatched via custom event for the hook to pick up
    window?.dispatchEvent?.(new CustomEvent('blinkone:dtmf', { detail: digit }));
  }

  const controls = [
    { icon: isMuted ? '🔇' : '🎤', label: isMuted ? t('call.unmute') : t('call.mute'), onPress: handleMute, active: isMuted },
    { icon: isOnHold ? '▶️' : '⏸', label: isOnHold ? t('call.unhold') : t('call.hold'), onPress: handleHold, active: isOnHold },
    { icon: '🔊', label: t('call.speaker'), onPress: handleSpeaker, active: isSpeaker },
    { icon: '⌨️', label: t('call.keypad'), onPress: () => setShowDtmf(true), active: showDtmf },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-between py-10 px-6">
      {/* Caller info */}
      <View className="items-center mt-8">
        <View className="w-24 h-24 rounded-full bg-surface-card border-2 border-brand items-center justify-center mb-6">
          <Text className="text-5xl">{activeCall?.direction === 'inbound' ? '📲' : '📞'}</Text>
        </View>
        <Text className="text-text-primary text-2xl font-bold">
          {activeCall?.customerPhone ?? 'Unknown'}
        </Text>
        <Text className="text-base mt-2" style={{ color: isOnHold ? '#f6ad55' : '#48bb78' }}>
          {isOnHold ? '⏸ On Hold' : `● ${formatSec(callDurationSec)}`}
        </Text>
      </View>

      {/* Controls */}
      <View className="w-full">
        <View className="flex-row justify-around mb-8 flex-wrap gap-y-4">
          {controls.map((ctrl) => (
            <TouchableOpacity key={ctrl.label} onPress={ctrl.onPress} className="items-center w-1/4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-2"
                style={{
                  backgroundColor: ctrl.active ? 'rgba(99,179,237,0.2)' : undefined,
                  borderWidth: 1,
                  borderColor: ctrl.active ? '#63b3ed' : 'rgba(255,255,255,0.1)',
                }}
              >
                <Text className="text-2xl">{ctrl.icon}</Text>
              </View>
              <Text className="text-text-muted text-xs text-center">{ctrl.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleEndCall}
          className="rounded-full py-5 items-center active:opacity-80"
          style={{ backgroundColor: '#e53e3e' }}
        >
          <Text className="text-white font-bold text-lg">📵 {t('call.end')}</Text>
        </TouchableOpacity>
      </View>

      {/* DTMF Modal */}
      <Modal visible={showDtmf} transparent animationType="slide" onRequestClose={() => setShowDtmf(false)}>
        <Pressable className="flex-1 bg-black/60" onPress={() => setShowDtmf(false)} />
        <View className="bg-bg rounded-t-3xl px-6 pt-4 pb-10">
          <View className="w-10 h-1 bg-surface-border rounded-full mx-auto mb-4" />
          <Text className="text-text-muted text-center text-sm mb-2 font-mono tracking-widest min-h-[24px]">
            {dtmfPressed || ' '}
          </Text>
          <View className="gap-3">
            {DTMF_KEYS.map((row, ri) => (
              <View key={ri} className="flex-row justify-between">
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    onPress={() => handleDtmf(digit)}
                    className="w-20 h-16 rounded-xl bg-surface-card border border-surface-border items-center justify-center"
                  >
                    <Text className="text-text-primary text-xl font-medium">{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
