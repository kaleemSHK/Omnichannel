import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useCallsStore } from '@/store/calls';
import { useSip } from '@/providers/sip-context';
import { navigationRef } from '@/navigation/navigationRef';
import { C } from '@/lib/ui';

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
      onPress={() => navigationRef.navigate('CallActive')}
      style={styles.bar}
    >
      <Text style={styles.callIcon}>📞</Text>
      <View style={styles.info}>
        <Text style={styles.label}>Active Call</Text>
        <Text style={styles.phone}>{activeCall.customerPhone}</Text>
      </View>
      <Text style={styles.timer}>{formatSec(callDurationSec)}</Text>
      <TouchableOpacity onPress={() => hangup()} style={styles.endBtn}>
        <Text style={styles.endText}>End</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: C.green,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 50,
  },
  callIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  info: {
    flex: 1,
  },
  label: {
    color: C.textWhite,
    fontWeight: '700',
    fontSize: 12,
  },
  phone: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  timer: {
    color: C.textWhite,
    fontSize: 14,
    marginRight: 16,
    fontVariant: ['tabular-nums'],
  },
  endBtn: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  endText: {
    color: C.textWhite,
    fontSize: 12,
    fontWeight: '700',
  },
});
