import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSip } from '@/providers/sip-context';
import { navigate } from '@/navigation/navigationRef';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { useCallsStore } from '@/store/calls';
import { usePermissions } from '@/hooks/usePermissions';
import { AppHeader } from '@/components/layout/AppHeader';
import { useEffect } from 'react';
import { C } from '@/lib/ui';

const DIALPAD: (string | { label: string; sub: string })[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [{ label: '*', sub: '' }, '0', { label: '#', sub: '' }],
];

export default function AgentDial() {
  const { t } = useTranslation();
  const [number, setNumber] = useState('');
  const { makeCall } = useSip();
  const activeCall = useCallsStore((s) => s.activeCall);
  const { requestMic } = usePermissions();

  useEffect(() => {
    if (activeCall) navigate('CallActive');
  }, [activeCall]);

  function press(digit: string) {
    hapticSelection();
    setNumber((n) => n + digit);
  }

  function backspace() {
    hapticSelection();
    setNumber((n) => n.slice(0, -1));
  }

  async function handleCall() {
    if (!number.trim()) return;
    const granted = await requestMic();
    if (!granted) {
      Alert.alert('Microphone Required', 'Please grant microphone access to make calls.');
      return;
    }
    hapticImpact('medium');
    void makeCall(number.trim());
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title={t('agent.dialpad')} />

      {/* Number display */}
      <View style={styles.numberDisplay}>
        <Text style={styles.numberText} numberOfLines={1} adjustsFontSizeToFit>
          {number || ' '}
        </Text>
        {number.length > 0 && (
          <TouchableOpacity onPress={backspace} style={styles.backspaceBtn}>
            <Text style={styles.backspaceText}>⌫</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dial pad grid */}
      <View style={styles.dialGrid}>
        {DIALPAD.map((row, ri) => (
          <View key={ri} style={styles.dialRow}>
            {row.map((cell) => {
              const digit = typeof cell === 'string' ? cell : cell.label;
              const sub = typeof cell === 'string' ? '' : cell.sub;
              return (
                <TouchableOpacity
                  key={digit}
                  onPress={() => press(digit)}
                  style={styles.dialKey}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dialDigit}>{digit}</Text>
                  {sub ? <Text style={styles.dialSub}>{sub}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.hint}>
        Dial <Text style={styles.hintStrong}>blinkone</Text> to ring the web agent desk
      </Text>

      {/* Call button */}
      <View style={styles.callBtnContainer}>
        <TouchableOpacity
          onPress={handleCall}
          disabled={!number.trim()}
          style={[styles.callBtn, { backgroundColor: number.trim() ? C.green : '#2d3748' }]}
        >
          <Text style={styles.callBtnIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  numberDisplay: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 32,
  },
  numberText: {
    color: C.text,
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 4,
    minHeight: 48,
  },
  backspaceBtn: {
    marginTop: 8,
    padding: 8,
  },
  backspaceText: {
    color: C.textMute,
    fontSize: 16,
  },
  dialGrid: {
    paddingHorizontal: 40,
    gap: 16,
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dialKey: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialDigit: {
    color: C.text,
    fontSize: 24,
    fontWeight: '500',
  },
  dialSub: {
    color: C.textMute,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  hint: {
    textAlign: 'center',
    color: C.textMute,
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 24,
  },
  hintStrong: {
    color: C.brand,
    fontWeight: '700',
  },
  callBtnContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  callBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnIcon: {
    fontSize: 30,
  },
});
