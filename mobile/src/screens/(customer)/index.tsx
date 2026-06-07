import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSip } from '@/providers/sip-context';
import { useCallsStore } from '@/store/calls';
import { AGENT_DESK_EXT } from '@/lib/env';
import { usePermissions } from '@/hooks/usePermissions';
import { ActiveCallBar } from '@/components/calling/ActiveCallBar';
import { IncomingCallSheet } from '@/components/calling/IncomingCallSheet';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { Five9Header } from '@/components/layout/Five9Header';
import { ActionTile } from '@/components/ui/ActionTile';
import { navigationRef, navigate } from '@/navigation/navigationRef';
import { hapticImpact } from '@/lib/haptics';
import { loadCustomerSession } from '@/lib/storage';
import { requestCustomerCall } from '@/api/customer';
import { randomId } from '@/lib/uuid';
import { SUPPORT_QUEUE } from '@/lib/env';
import { C } from '@/lib/ui';

export default function CustomerHome() {
  const { t } = useTranslation();
  const { makeCall } = useSip();
  const activeCall = useCallsStore((s) => s.activeCall);
  const incomingCalls = useCallsStore((s) => s.incomingCalls);
  const sipRegistered = useCallsStore((s) => s.sipRegistered);
  const { requestMic } = usePermissions();
  const [calling, setCalling] = useState(false);

  async function handleCallSupport() {
    const granted = await requestMic();
    if (!granted) {
      Alert.alert('Microphone Required', 'Please grant microphone permission to call support.');
      return;
    }
    hapticImpact('medium');
    setCalling(true);
    try {
      const session = await loadCustomerSession();
      if (!session.token) {
        Alert.alert('Session required', 'Please complete setup from the welcome screen first.');
        setCalling(false);
        return;
      }
      const callId = randomId();
      try {
        const route = await requestCustomerCall({
          callId,
          queueKey: SUPPORT_QUEUE,
          callerName: session.name?.trim() || undefined,
          contactId: session.contactId,
          callerId: session.contactId ? String(session.contactId) : undefined,
        });
        if (route.status === 'queued' || route.status === 'assigned') {
          setCalling(false);
          navigate('Customer', {
            screen: 'CallQueue',
            params: { callId, welcomeMessage: route.welcomeMessage },
          });
          return;
        }
      } catch (routeErr) {
        console.warn('[CALL] ACD request failed, placing SIP call directly', routeErr);
      }
      void makeCall(AGENT_DESK_EXT);
    } catch (e) {
      setCalling(false);
      Alert.alert('Call failed', e instanceof Error ? e.message : 'Could not reach support');
    }
  }

  useEffect(() => {
    if (activeCall) navigate('CallActive');
    else setCalling(false);
  }, [activeCall]);

  useEffect(() => {
    if (!sipRegistered) setCalling(false);
  }, [sipRegistered]);

  const callReady = sipRegistered && !calling;

  return (
    <View style={s.screen}>
      <OfflineBanner />
      <Five9Header
        title="BlinkOne Support"
        subtitle="How can we help you today?"
        right={
          sipRegistered ? (
            <View style={s.onlinePill}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>Ready</Text>
            </View>
          ) : (
            <ActivityIndicator color="#fff" size="small" />
          )
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.section}>GET SUPPORT</Text>

        <ActionTile
          variant="primary"
          icon="call"
          title={calling ? t('customer.calling') : t('customer.call_support')}
          subtitle={
            calling
              ? 'Connecting you to the next available agent…'
              : callReady
                ? 'Tap to speak with an agent now'
                : 'Connecting to phone system…'
          }
          onPress={handleCallSupport}
          disabled={calling || !sipRegistered}
        />

        <Text style={s.section}>OTHER OPTIONS</Text>

        <ActionTile
          icon="chatbubbles"
          iconColor={C.brand}
          iconBg={C.bgBlue}
          title={t('customer.start_chat')}
          subtitle="Send a message — we reply during business hours"
          onPress={() =>
            navigationRef.navigate('Customer', { screen: 'ChatDetail', params: { id: 'new' } })
          }
        />

        <ActionTile
          icon="document-text"
          iconColor={C.purple}
          iconBg={C.purpleBg}
          title={t('customer.my_tickets')}
          subtitle="Track and manage your support requests"
          onPress={() =>
            navigationRef.navigate('Customer', {
              screen: 'CustomerTabs',
              params: { screen: 'Tickets' },
            })
          }
        />

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Estimated response</Text>
          <Text style={s.infoBody}>
            Voice calls are routed to the next available agent. Chat and tickets are answered in
            queue order.
          </Text>
        </View>
      </ScrollView>

      {activeCall ? <ActiveCallBar /> : null}
      {incomingCalls.length > 0 ? <IncomingCallSheet /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  section: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMute,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14,159,110,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  onlineText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  infoCard: {
    marginTop: 8,
    backgroundColor: C.bgCard,
    borderRadius: C.r.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  infoBody: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 19,
  },
});
