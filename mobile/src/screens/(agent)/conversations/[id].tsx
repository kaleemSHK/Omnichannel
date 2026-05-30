import { useCallback } from 'react';
import { View, FlatList, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversation, updateConversationStatus } from '@/api/conversations';
import { AppHeader } from '@/components/layout/AppHeader';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { useMessages } from '@/hooks/useMessages';
import { useActionCable } from '@/hooks/useActionCable';
import { can } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth';
import type { AgentStackParamList } from '@/navigation/types';
import { C } from '@/lib/ui';

export default function AgentConversationDetail() {
  const route = useRoute<RouteProp<AgentStackParamList, 'ConversationDetail'>>();
  const conversationId = Number(route.params.id);
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: conversationId > 0,
  });

  const { messages, isLoading, send, refetch } = useMessages(conversationId);

  const onRealtime = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
  }, [queryClient, conversationId]);

  useActionCable(conversationId, { onMessage: onRealtime, onStatusChange: onRealtime });

  async function toggleStatus() {
    if (!conversation) return;
    const next = conversation.status === 'open' ? 'resolved' : 'open';
    await updateConversationStatus(conversationId, next);
    queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
  }

  const title = conversation?.meta.sender.name ?? t('agent.conversations');
  const canResolve = can(user?.role, 'resolveConversation');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader
        title={title}
        right={
          canResolve ? (
            <TouchableOpacity onPress={toggleStatus} style={styles.resolveBtn}>
              <Text style={styles.resolveBtnText}>
                {conversation?.status === 'open' ? t('conv.resolve') : t('conv.reopen')}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={C.brand} />
        </View>
      ) : (
        <>
          <FlatList
            data={[...messages].reverse()}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <MessageBubble message={item} isOwn={item.message_type === 1} />
            )}
            contentContainerStyle={{ padding: 16 }}
            onRefresh={refetch}
            refreshing={false}
          />
          <MessageInput onSend={send} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resolveBtnText: {
    color: C.brand,
    fontSize: 14,
    fontWeight: '600',
  },
});
