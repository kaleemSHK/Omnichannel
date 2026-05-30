import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSip } from '@/providers/sip-context';
import { useCallsStore } from '@/store/calls';
import { SUPPORT_EXT } from '@/lib/env';
import { usePermissions } from '@/hooks/usePermissions';
import { ActiveCallBar } from '@/components/calling/ActiveCallBar';
import { IncomingCallSheet } from '@/components/calling/IncomingCallSheet';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { navigationRef } from '@/navigation/navigationRef';
import { hapticImpact } from '@/lib/haptics';
import { C } from '@/lib/ui';

export default function CustomerHome() {
  const { t } = useTranslation();
  const { makeCall } = useSip();
  const activeCall = useCallsStore((s) => s.activeCall);
  const incomingCalls = useCallsStore((s) => s.incomingCalls);
  const { requestMic } = usePermissions();
  const [calling, setCalling] = useState(false);

  async function handleCallSupport() {
    const granted = await requestMic();
    if (!granted) { Alert.alert('Microphone Required', 'Please grant microphone permission.'); return; }
    hapticImpact('medium');
    setCalling(true);
    makeCall(SUPPORT_EXT);
  }

  useEffect(() => {
    if (activeCall) navigationRef.navigate('CallActive');
    else setCalling(false);
  }, [activeCall]);

  return (
    <SafeAreaView style={s.screen}>
      <OfflineBanner />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 }}>
        <View style={{ marginBottom: 32 }}>
          <Text style={s.brand}>BlinkOne</Text>
          <Text style={s.sub}>How can we help you today?</Text>
        </View>

        {/* Call Support */}
        <TouchableOpacity onPress={handleCallSupport} disabled={calling} activeOpacity={0.85}
          style={[s.card, { backgroundColor: C.green, borderColor: C.green, marginBottom: 12 }]}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>📞</Text>
          <Text style={[s.cardTitle, { color: '#fff' }]}>
            {calling ? t('customer.calling') : t('customer.call_support')}
          </Text>
          <Text style={[s.cardSub, { color: 'rgba(255,255,255,0.8)' }]}>
            {calling ? 'Connecting you to an agent…' : 'Talk to us right now'}
          </Text>
        </TouchableOpacity>

        {/* Chat */}
        <TouchableOpacity
          onPress={() => navigationRef.navigate('Customer', { screen: 'ChatDetail', params: { id: 'new' } })}
          activeOpacity={0.85} style={[s.card, s.cardRow, { marginBottom: 12 }]}>
          <Text style={{ fontSize: 32, marginRight: 14 }}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardRowTitle}>{t('customer.start_chat')}</Text>
            <Text style={s.cardRowSub}>Send us a message anytime</Text>
          </View>
          <Text style={{ color: C.textMute, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* Tickets */}
        <TouchableOpacity
          onPress={() => navigationRef.navigate('Customer', { screen: 'CustomerTabs', params: { screen: 'Tickets' } })}
          activeOpacity={0.85} style={[s.card, s.cardRow]}>
          <Text style={{ fontSize: 32, marginRight: 14 }}>🎫</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardRowTitle}>{t('customer.my_tickets')}</Text>
            <Text style={s.cardRowSub}>Track your support requests</Text>
          </View>
          <Text style={{ color: C.textMute, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {activeCall ? <ActiveCallBar /> : null}
      {incomingCalls.length > 0 ? <IncomingCallSheet /> : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: C.bg },
  brand:       { fontSize: 28, fontWeight: '800', color: C.brand, marginBottom: 4 },
  sub:         { fontSize: 14, color: C.textSub },
  card:        { backgroundColor: C.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardRow:     { flexDirection: 'row', alignItems: 'center' },
  cardTitle:   { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
  cardSub:     { fontSize: 13, color: C.textSub },
  cardRowTitle:{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  cardRowSub:  { fontSize: 13, color: C.textSub },
});
