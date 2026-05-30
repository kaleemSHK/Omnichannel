import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { setSpeakerphoneOn } from '@/lib/audio';
import { C } from '@/lib/ui';

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
  const navigation = useNavigation();
  const activeCall = useCallsStore((s) => s.activeCall);
  const isMuted = useCallsStore((s) => s.isMuted);
  const isOnHold = useCallsStore((s) => s.isOnHold);
  const callDurationSec = useCallsStore((s) => s.callDurationSec);
  const { hangup, mute, unmute, hold, unhold, sendDtmf } = useSip();
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showDtmf, setShowDtmf] = useState(false);
  const [dtmfPressed, setDtmfPressed] = useState('');

  useEffect(() => {
    if (!activeCall) navigation.goBack();
  }, [activeCall, navigation]);

  async function handleEndCall() {
    hapticImpact('heavy');
    hangup();
    navigation.goBack();
  }

  function handleMute() {
    hapticSelection();
    if (isMuted) unmute();
    else mute();
  }

  async function handleHold() {
    hapticSelection();
    if (isOnHold) await unhold();
    else await hold();
  }

  async function handleSpeaker() {
    hapticSelection();
    const next = !isSpeaker;
    setIsSpeaker(next);
    try {
      await setSpeakerphoneOn(next);
    } catch {
      /* non-critical */
    }
  }

  function handleDtmf(digit: string) {
    hapticSelection();
    setDtmfPressed((d) => d + digit);
    sendDtmf(digit);
  }

  const controls = [
    { icon: isMuted ? '🔇' : '🎤', label: isMuted ? t('call.unmute') : t('call.mute'), onPress: handleMute, active: isMuted },
    { icon: isOnHold ? '▶️' : '⏸', label: isOnHold ? t('call.unhold') : t('call.hold'), onPress: handleHold, active: isOnHold },
    { icon: '🔊', label: t('call.speaker'), onPress: handleSpeaker, active: isSpeaker },
    { icon: '⌨️', label: t('call.keypad'), onPress: () => setShowDtmf(true), active: showDtmf },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      {/* Caller info */}
      <View style={styles.callerSection}>
        <View style={styles.callerAvatar}>
          <Text style={styles.callerAvatarIcon}>
            {activeCall?.direction === 'inbound' ? '📲' : '📞'}
          </Text>
        </View>
        <Text style={styles.callerPhone}>
          {activeCall?.customerPhone ?? 'Unknown'}
        </Text>
        <Text style={[styles.callStatus, { color: isOnHold ? C.amber : C.green }]}>
          {isOnHold ? '⏸ On Hold' : `● ${formatSec(callDurationSec)}`}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsSection}>
        <View style={styles.controlsGrid}>
          {controls.map((ctrl) => (
            <TouchableOpacity key={ctrl.label} onPress={ctrl.onPress} style={styles.controlItem}>
              <View style={[
                styles.controlBtn,
                {
                  backgroundColor: ctrl.active ? 'rgba(37,99,235,0.15)' : 'transparent',
                  borderColor: ctrl.active ? C.brand : C.border,
                },
              ]}>
                <Text style={styles.controlIcon}>{ctrl.icon}</Text>
              </View>
              <Text style={styles.controlLabel}>{ctrl.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleEndCall}
          style={styles.endCallBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.endCallText}>📵 {t('call.end')}</Text>
        </TouchableOpacity>
      </View>

      {/* DTMF Modal */}
      <Modal visible={showDtmf} transparent animationType="slide" onRequestClose={() => setShowDtmf(false)}>
        <Pressable style={styles.dtmfBackdrop} onPress={() => setShowDtmf(false)} />
        <View style={styles.dtmfSheet}>
          <View style={styles.dtmfHandle} />
          <Text style={styles.dtmfDisplay}>{dtmfPressed || ' '}</Text>
          <View style={styles.dtmfGrid}>
            {DTMF_KEYS.map((row, ri) => (
              <View key={ri} style={styles.dtmfRow}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    onPress={() => handleDtmf(digit)}
                    style={styles.dtmfKey}
                  >
                    <Text style={styles.dtmfKeyText}>{digit}</Text>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  callerSection: {
    alignItems: 'center',
    marginTop: 32,
  },
  callerAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.bgCard,
    borderWidth: 2,
    borderColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  callerAvatarIcon: {
    fontSize: 48,
  },
  callerPhone: {
    color: C.text,
    fontSize: 24,
    fontWeight: '700',
  },
  callStatus: {
    fontSize: 16,
    marginTop: 8,
  },
  controlsSection: {
    width: '100%',
  },
  controlsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
    flexWrap: 'wrap',
    rowGap: 16,
  },
  controlItem: {
    alignItems: 'center',
    width: '25%',
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  controlIcon: {
    fontSize: 24,
  },
  controlLabel: {
    color: C.textMute,
    fontSize: 12,
    textAlign: 'center',
  },
  endCallBtn: {
    backgroundColor: C.red,
    borderRadius: 999,
    paddingVertical: 20,
    alignItems: 'center',
  },
  endCallText: {
    color: C.textWhite,
    fontWeight: '700',
    fontSize: 18,
  },
  dtmfBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dtmfSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  dtmfHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dtmfDisplay: {
    color: C.textMute,
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
    minHeight: 24,
    letterSpacing: 2,
  },
  dtmfGrid: {
    gap: 12,
  },
  dtmfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dtmfKey: {
    width: 80,
    height: 64,
    borderRadius: 12,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dtmfKeyText: {
    color: C.text,
    fontSize: 20,
    fontWeight: '500',
  },
});
