import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallQueue } from '@/hooks/useCallQueue';
import { useDialOnAssign } from '@/hooks/useDialOnAssign';
import { cancelCustomerCall } from '@/api/customer';
import { useSip } from '@/providers/sip-context';
import { useCallsStore } from '@/store/calls';
import { hapticImpact } from '@/lib/haptics';
import { CallScreenLayout, CallTheme } from '@/components/calling/CallScreenLayout';
import type { CustomerStackParamList } from '@/navigation/types';

type Route = RouteProp<CustomerStackParamList, 'CallQueue'>;
type Nav = NativeStackNavigationProp<CustomerStackParamList>;

export default function CustomerCallQueue() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { makeCall, hangup } = useSip();
  const sipRegistered = useCallsStore((s) => s.sipRegistered);
  const callId = params.callId;
  const welcomeMessage =
    params.welcomeMessage ??
    'Welcome to BlinkOne support. Please wait while we connect you to an agent.';

  const { status, error } = useCallQueue({
    callId,
    mode: 'customer',
    onAssigned: () => hapticImpact('medium'),
  });

  const { dialError, connecting } = useDialOnAssign(callId, status, makeCall);

  const isQueued = status?.status === 'queued' || status?.status === 'routing';
  const isAssigned = status?.status === 'assigned';
  const position = status?.position ?? 1;
  const depth = status?.depth ?? position;

  let statusLabel = 'Waiting for an agent…';
  if (isAssigned) {
    if (dialError) statusLabel = dialError;
    else if (!sipRegistered) statusLabel = 'Connecting phone…';
    else if (connecting) statusLabel = 'Calling support…';
    else statusLabel = 'Ringing…';
  }

  return (
    <CallScreenLayout
      title="BlinkOne Support"
      subtitle={isQueued ? `Position ${position} · ${depth} in queue` : 'Voice support'}
      statusLabel={statusLabel}
      pulse={isAssigned || isQueued}
      avatarLabel="BS"
      onEndCall={() => {
        hangup();
        void cancelCustomerCall(callId).catch(() => {});
        navigation.goBack();
      }}
      endLabel="Cancel call"
    >
      <View style={styles.welcomeBox}>
        <Text style={styles.welcomeText}>{welcomeMessage}</Text>
      </View>
      {(connecting || (isAssigned && !dialError)) && (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={CallTheme.accent} />
        </View>
      )}
      {!!(error || dialError) && !isAssigned && (
        <Text style={styles.error}>{error ?? dialError}</Text>
      )}
    </CallScreenLayout>
  );
}

const styles = StyleSheet.create({
  welcomeBox: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  welcomeText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  spinnerWrap: { marginTop: 24 },
  error: { color: CallTheme.red, marginTop: 16, textAlign: 'center', fontSize: 14 },
});
