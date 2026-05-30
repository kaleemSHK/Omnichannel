import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSip } from '@/providers/sip-context';
import { navigationRef } from '@/navigation/navigationRef';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { useCallsStore } from '@/store/calls';
import { usePermissions } from '@/hooks/usePermissions';
import { AppHeader } from '@/components/layout/AppHeader';
import { useEffect } from 'react';

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
    if (activeCall) navigationRef.navigate('CallActive');
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
    makeCall(number.trim());
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title={t('agent.dialpad')} />

      {/* Number display */}
      <View className="items-center px-6 mt-6 mb-8">
        <Text
          className="text-text-primary text-4xl font-light tracking-widest min-h-[48px]"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {number || ' '}
        </Text>
        {number.length > 0 && (
          <TouchableOpacity onPress={backspace} className="mt-2 p-2">
            <Text className="text-text-muted text-base">⌫</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dial pad grid */}
      <View className="px-10 gap-4">
        {DIALPAD.map((row, ri) => (
          <View key={ri} className="flex-row justify-between">
            {row.map((cell) => {
              const digit = typeof cell === 'string' ? cell : cell.label;
              const sub = typeof cell === 'string' ? '' : cell.sub;
              return (
                <TouchableOpacity
                  key={digit}
                  onPress={() => press(digit)}
                  className="w-20 h-20 rounded-full bg-surface-card border border-surface-border items-center justify-center"
                >
                  <Text className="text-text-primary text-2xl font-medium">{digit}</Text>
                  {sub ? <Text className="text-text-muted text-[10px] tracking-widest">{sub}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Call button */}
      <View className="items-center mt-8">
        <TouchableOpacity
          onPress={handleCall}
          disabled={!number.trim()}
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: number.trim() ? '#48bb78' : '#2d3748' }}
        >
          <Text className="text-3xl">📞</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
