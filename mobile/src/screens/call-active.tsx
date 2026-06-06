import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { setSpeakerphoneOn } from '@/lib/audio';
import { CallScreenLayout, CallTheme } from '@/components/calling/CallScreenLayout';

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
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [showDtmf, setShowDtmf] = useState(false);
  const [dtmfPressed, setDtmfPressed] = useState('');

  useEffect(() => {
    if (!activeCall) navigation.goBack();
  }, [activeCall, navigation]);

  useEffect(() => {
    if (activeCall?.status === 'connected') {
      void setSpeakerphoneOn(true);
    }
  }, [activeCall?.status]);

  const connected = activeCall?.status === 'connected';
  const title = activeCall?.customerPhone ?? 'Support';
  const statusLabel = connected
    ? formatSec(callDurationSec)
    : isOnHold
      ? 'On hold'
      : 'Ringing…';

  async function handleEndCall() {
    hapticImpact('heavy');
    hangup();
    useCallsStore.getState().setCustomerQueueCallId(null);
    if (navigation.canGoBack()) navigation.goBack();
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

  const controls = (
    <View style={styles.controlsRow}>
      <ControlBtn icon={isMuted ? '🔇' : '🎤'} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} onPress={handleMute} />
      <ControlBtn icon="🔊" label="Speaker" active={isSpeaker} onPress={() => void handleSpeaker()} />
      <ControlBtn icon={isOnHold ? '▶️' : '⏸'} label={isOnHold ? 'Resume' : 'Hold'} active={isOnHold} onPress={() => void handleHold()} />
      <ControlBtn icon="⌨️" label="Keypad" active={showDtmf} onPress={() => setShowDtmf(true)} />
    </View>
  );

  return (
    <>
      <CallScreenLayout
        title={title}
        subtitle={activeCall?.direction === 'inbound' ? 'Incoming' : 'Outgoing'}
        statusLabel={statusLabel}
        statusColor={connected ? CallTheme.accent : CallTheme.textMute}
        pulse={!connected}
        avatarLabel={title.slice(0, 2)}
        onEndCall={handleEndCall}
        endLabel={t('call.end')}
        footer={controls}
      />

      <Modal visible={showDtmf} transparent animationType="slide" onRequestClose={() => setShowDtmf(false)}>
        <Pressable style={styles.dtmfBackdrop} onPress={() => setShowDtmf(false)} />
        <View style={styles.dtmfSheet}>
          <View style={styles.dtmfHandle} />
          <Text style={styles.dtmfDisplay}>{dtmfPressed || ' '}</Text>
          {DTMF_KEYS.map((row, ri) => (
            <View key={ri} style={styles.dtmfRow}>
              {row.map((digit) => (
                <TouchableOpacity key={digit} onPress={() => handleDtmf(digit)} style={styles.dtmfKey}>
                  <Text style={styles.dtmfKeyText}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </Modal>
    </>
  );
}

function ControlBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.controlItem}>
      <View style={[styles.controlCircle, active && styles.controlCircleActive]}>
        <Text style={styles.controlIcon}>{icon}</Text>
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  controlItem: { alignItems: 'center', width: 72 },
  controlCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CallTheme.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  controlCircleActive: {
    backgroundColor: 'rgba(0,168,132,0.25)',
    borderWidth: 1,
    borderColor: CallTheme.accent,
  },
  controlIcon: { fontSize: 22 },
  controlLabel: { color: CallTheme.textMute, fontSize: 11 },
  dtmfBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  dtmfSheet: {
    backgroundColor: CallTheme.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  dtmfHandle: {
    width: 40,
    height: 4,
    backgroundColor: CallTheme.bgSoft,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dtmfDisplay: {
    color: CallTheme.text,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 4,
    marginBottom: 16,
    minHeight: 28,
  },
  dtmfRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  dtmfKey: {
    width: 72,
    height: 56,
    borderRadius: 28,
    backgroundColor: CallTheme.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dtmfKeyText: { color: CallTheme.text, fontSize: 22, fontWeight: '600' },
});
