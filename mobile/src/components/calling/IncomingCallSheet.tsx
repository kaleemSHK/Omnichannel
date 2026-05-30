import { View, Text, TouchableOpacity, Vibration, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';
import { usePermissions } from '@/hooks/usePermissions';
import { navigationRef } from '@/navigation/navigationRef';
import { hapticImpact } from '@/lib/haptics';
import { C } from '@/lib/ui';

export function IncomingCallSheet() {
  const { t } = useTranslation();
  const incomingCalls = useCallsStore((s) => s.incomingCalls);
  const removeIncomingCall = useCallsStore((s) => s.removeIncomingCall);
  const { answerCall, declineCall } = useSip();
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
    hapticImpact('medium');
    Vibration.cancel();
    const granted = await requestMic();
    if (!granted) return;
    answerCall();
    navigationRef.navigate('CallActive');
  }

  function handleDecline() {
    hapticImpact('heavy');
    Vibration.cancel();
    declineCall();
    removeIncomingCall(call.callId);
  }

  return (
    <View style={styles.sheet}>
      <Text style={styles.incomingLabel}>{t('agent.incoming_call')}</Text>
      <Text style={styles.callerName}>{call.callerName}</Text>
      <Text style={styles.callerNumber}>{call.callerNumber}</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity onPress={handleDecline} style={styles.declineBtn} activeOpacity={0.7}>
          <Text style={styles.btnIcon}>📵</Text>
          <Text style={styles.declineText}>{t('call.decline')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleAnswer} style={styles.answerBtn} activeOpacity={0.7}>
          <Text style={styles.btnIcon}>📞</Text>
          <Text style={styles.answerText}>{t('call.answer')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.bgCard,
    borderTopWidth: 1,
    borderColor: C.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  incomingLabel: {
    color: C.textMute,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  callerName: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  callerNumber: {
    color: C.textSub,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  answerBtn: {
    flex: 1,
    backgroundColor: C.green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  declineText: {
    color: C.red,
    fontWeight: '600',
  },
  answerText: {
    color: C.textWhite,
    fontWeight: '700',
  },
});
