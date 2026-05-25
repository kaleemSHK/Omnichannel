import { View, Text, TouchableOpacity, Vibration } from 'react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';
import { usePermissions } from '@/hooks/usePermissions';

export function IncomingCallSheet() {
  const { t } = useTranslation();
  const incomingCalls = useCallsStore((s) => s.incomingCalls);
  const removeIncomingCall = useCallsStore((s) => s.removeIncomingCall);
  const { answerCall, hangup } = useSip();
  const { requestMic } = usePermissions();

  const call = incomingCalls[0];

  useEffect(() => {
    if (!call) return;
    const pattern = [0, 500, 300, 500];
    Vibration.vibrate(pattern, true);
    return () => Vibration.cancel();
  }, [call?.callId]);

  if (!call) return null;

  async function handleAnswer() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.cancel();
    const granted = await requestMic();
    if (!granted) return;
    answerCall();
    router.push('/call-active');
  }

  function handleDecline() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Vibration.cancel();
    hangup();
    removeIncomingCall(call.callId);
  }

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-surface-card border-t border-surface-border rounded-t-3xl px-6 py-6">
      <Text className="text-text-muted text-xs text-center mb-1 uppercase tracking-widest">
        {t('agent.incoming_call')}
      </Text>
      <Text className="text-text-primary text-xl font-bold text-center mb-0.5">{call.callerName}</Text>
      <Text className="text-text-secondary text-sm text-center mb-6">{call.callerNumber}</Text>

      <View className="flex-row gap-4">
        <TouchableOpacity
          onPress={handleDecline}
          className="flex-1 bg-danger/20 border border-danger/40 rounded-2xl py-4 items-center active:opacity-70"
        >
          <Text className="text-2xl mb-1">📵</Text>
          <Text className="text-danger font-semibold">{t('call.decline')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAnswer}
          className="flex-1 bg-success rounded-2xl py-4 items-center active:opacity-70"
        >
          <Text className="text-2xl mb-1">📞</Text>
          <Text className="text-black font-bold">{t('call.answer')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
