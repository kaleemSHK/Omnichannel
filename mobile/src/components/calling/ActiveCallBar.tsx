import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';

function formatSec(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function ActiveCallBar() {
  const activeCall = useCallsStore((s) => s.activeCall);
  const callDurationSec = useCallsStore((s) => s.callDurationSec);
  const { hangup } = useSip();

  if (!activeCall) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/call-active')}
      className="absolute top-0 left-0 right-0 bg-success flex-row items-center px-4 py-2 z-50"
    >
      <Text className="text-black text-lg mr-2">📞</Text>
      <View className="flex-1">
        <Text className="text-black font-bold text-xs">Active Call</Text>
        <Text className="text-black/70 text-xs">{activeCall.customerPhone}</Text>
      </View>
      <Text className="text-black font-mono text-sm mr-4">{formatSec(callDurationSec)}</Text>
      <TouchableOpacity
        onPress={() => hangup()}
        className="bg-black/20 rounded-full px-3 py-1"
      >
        <Text className="text-black text-xs font-bold">End</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
