import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallActiveScreen() {
  const { t } = useTranslation();
  const activeCall = useCallsStore((s) => s.activeCall);
  const isMuted = useCallsStore((s) => s.isMuted);
  const isOnHold = useCallsStore((s) => s.isOnHold);
  const callDurationSec = useCallsStore((s) => s.callDurationSec);
  const { hangup, mute, unmute, hold, unhold } = useSip();

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

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-between py-10 px-6">
      <View className="items-center mt-8">
        <View className="w-24 h-24 rounded-full bg-surface-card border-2 border-brand items-center justify-center mb-6">
          <Text className="text-5xl">{activeCall?.direction === 'inbound' ? '📲' : '📞'}</Text>
        </View>
        <Text className="text-text-primary text-2xl font-bold">{activeCall?.customerPhone ?? 'Unknown'}</Text>
        <Text className="text-success text-base mt-2">
          {isOnHold ? '⏸ On Hold' : `● ${formatSec(callDurationSec)}`}
        </Text>
      </View>

      <View className="w-full">
        <View className="flex-row justify-around mb-8">
          {[
            {
              icon: isMuted ? '🔇' : '🎤',
              label: isMuted ? t('call.unmute') : t('call.mute'),
              onPress: handleMute,
            },
            {
              icon: isOnHold ? '▶️' : '⏸',
              label: isOnHold ? t('call.unhold') : t('call.hold'),
              onPress: handleHold,
            },
            { icon: '🔊', label: t('call.speaker'), onPress: () => {} },
          ].map((ctrl) => (
            <TouchableOpacity key={ctrl.label} onPress={ctrl.onPress} className="items-center">
              <View className="w-16 h-16 rounded-full bg-surface-card border border-surface-border items-center justify-center mb-2">
                <Text className="text-2xl">{ctrl.icon}</Text>
              </View>
              <Text className="text-text-muted text-xs">{ctrl.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleEndCall}
          className="bg-danger rounded-full py-5 items-center active:opacity-80"
        >
          <Text className="text-white font-bold text-lg">📵 {t('call.end')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
