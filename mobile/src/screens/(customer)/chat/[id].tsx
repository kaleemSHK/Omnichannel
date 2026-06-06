import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { SupportChatHeader } from '@/components/chat/SupportChatHeader';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { CustomerMessageInput } from '@/components/chat/CustomerMessageInput';
import { useMessages } from '@/hooks/useMessages';
import { startCustomerSession } from '@/api/customer';
import { loadCustomerSession, saveCustomerSession } from '@/lib/storage';
import { C } from '@/lib/ui';
import type { CustomerStackParamList } from '@/navigation/types';

export default function CustomerChatScreen() {
  const route = useRoute<RouteProp<CustomerStackParamList, 'ChatDetail'>>();
  const id = route.params.id;
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<number>(() =>
    id && id !== 'new' ? Number(id) : 0,
  );
  const [bootstrapping, setBootstrapping] = useState(id === 'new');
  const { messages, isLoading, send, error, refetch } = useMessages(conversationId);

  const handleSend = useCallback(
    async (text: string) => {
      try {
        await send(text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not send message';
        Alert.alert('Message failed', msg);
        throw e;
      }
    },
    [send],
  );

  useEffect(() => {
    if (id !== 'new' || conversationId > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await loadCustomerSession();
        if (session.conversationId) {
          setConversationId(session.conversationId);
          setBootstrapping(false);
          return;
        }
        const created = await startCustomerSession({
          name: session.name ?? 'Mobile Customer',
          contactId: session.contactId,
          conversationId: session.conversationId,
          accountId: session.accountId,
        });
        if (cancelled) return;
        await saveCustomerSession({
          token: created.token,
          contactId: created.contactId,
          conversationId: created.conversationId,
          accountId: created.accountId,
          name: created.name,
        });
        setConversationId(created.conversationId);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Could not start chat';
          Alert.alert('Chat unavailable', msg, [
            { text: 'Retry', onPress: () => navigation.goBack() },
          ]);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, conversationId]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <SupportChatHeader />
      {bootstrapping || (isLoading && conversationId === 0) ? (
        <View style={s.center}>
          <ActivityIndicator color={C.brand} size="large" />
        </View>
      ) : (
        <>
          {!!error && (
            <View style={s.errorBanner}>
              <Text style={s.errorText}>{error}</Text>
              <Text style={s.retryLink} onPress={() => void refetch()}>
                Tap to retry
              </Text>
            </View>
          )}
          <FlatList
            data={[...messages].reverse()}
            inverted
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => <MessageBubble message={item} viewer="customer" />}
            contentContainerStyle={s.list}
            style={s.listBg}
            ListEmptyComponent={
              !isLoading ? (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyText}>No messages yet. Say hello!</Text>
                </View>
              ) : null
            }
          />
          <CustomerMessageInput onSend={handleSend} disabled={conversationId <= 0} />
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF2FF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listBg: { flex: 1 },
  list: { paddingHorizontal: 14, paddingVertical: 16 },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: { color: '#B91C1C', fontSize: 13 },
  retryLink: { color: C.brand, fontSize: 13, fontWeight: '600', marginTop: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: C.textMute, fontSize: 14 },
});
