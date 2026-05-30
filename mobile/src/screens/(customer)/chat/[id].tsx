import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { AppHeader } from '@/components/layout/AppHeader';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { useMessages } from '@/hooks/useMessages';
import { useActionCable } from '@/hooks/useActionCable';
import { startCustomerSession } from '@/api/customer';
import { loadCustomerSession, saveCustomerSession } from '@/lib/storage';
import type { CustomerStackParamList } from '@/navigation/types';

export default function CustomerChatScreen() {
  const route = useRoute<RouteProp<CustomerStackParamList, 'ChatDetail'>>();
  const id = route.params.id;
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<number>(() =>
    id && id !== 'new' ? Number(id) : 0,
  );
  const [bootstrapping, setBootstrapping] = useState(id === 'new');

  const { messages, isLoading, send, refetch } = useMessages(conversationId);

  const onRealtime = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
  }, [queryClient, conversationId]);

  useActionCable(conversationId, { onMessage: onRealtime });

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
          Alert.alert('Chat unavailable', e instanceof Error ? e.message : 'Could not start chat');
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title="Support Chat" />
      {bootstrapping || (isLoading && conversationId === 0) ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#63b3ed" />
        </View>
      ) : (
        <>
          <FlatList
            data={[...messages].reverse()}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={{ padding: 16, gap: 8 }}
          />
          <MessageInput onSend={(text) => send(text)} />
        </>
      )}
    </SafeAreaView>
  );
}
