import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
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

export default function CustomerHome() {
  const { t } = useTranslation();
  const { makeCall } = useSip();
  const activeCall = useCallsStore((s) => s.activeCall);
  const incomingCalls = useCallsStore((s) => s.incomingCalls);
  const { requestMic } = usePermissions();
  const [calling, setCalling] = useState(false);

  async function handleCallSupport() {
    const granted = await requestMic();
    if (!granted) {
      Alert.alert('Microphone Required', 'Please grant microphone permission to make calls.');
      return;
    }
    hapticImpact('medium');
    setCalling(true);
    makeCall(SUPPORT_EXT);
  }

  useEffect(() => {
    if (activeCall) navigationRef.navigate('CallActive');
    else setCalling(false);
  }, [activeCall]);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <OfflineBanner />
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}>
        <View className="mb-8">
          <Text className="text-brand text-2xl font-bold">BlinkOne</Text>
          <Text className="text-text-secondary text-sm mt-1">How can we help you today?</Text>
        </View>

        <TouchableOpacity
          onPress={handleCallSupport}
          disabled={calling}
          className="bg-success rounded-2xl p-6 mb-4 items-center active:opacity-80"
        >
          <Text className="text-5xl mb-3">📞</Text>
          <Text className="text-black text-xl font-bold">
            {calling ? t('customer.calling') : t('customer.call_support')}
          </Text>
          <Text className="text-black/60 text-sm mt-1">
            {calling ? 'Connecting you to an agent…' : 'Talk to us right now'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigationRef.navigate('Customer', { screen: 'ChatDetail', params: { id: 'new' } })
          }
          className="bg-surface-card border border-surface-border rounded-2xl p-5 mb-4 flex-row items-center active:opacity-70"
        >
          <Text className="text-3xl mr-4">💬</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-bold text-base">{t('customer.start_chat')}</Text>
            <Text className="text-text-secondary text-sm mt-0.5">Send us a message anytime</Text>
          </View>
          <Text className="text-text-muted text-lg">›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigationRef.navigate('Customer', { screen: 'CustomerTabs', params: { screen: 'Tickets' } })
          }
          className="bg-surface-card border border-surface-border rounded-2xl p-5 flex-row items-center active:opacity-70"
        >
          <Text className="text-3xl mr-4">🎫</Text>
          <View className="flex-1">
            <Text className="text-text-primary font-bold text-base">{t('customer.my_tickets')}</Text>
            <Text className="text-text-secondary text-sm mt-0.5">Track your support requests</Text>
          </View>
          <Text className="text-text-muted text-lg">›</Text>
        </TouchableOpacity>
      </ScrollView>

      {activeCall ? <ActiveCallBar /> : null}
      {incomingCalls.length > 0 ? <IncomingCallSheet /> : null}
    </SafeAreaView>
  );
}
