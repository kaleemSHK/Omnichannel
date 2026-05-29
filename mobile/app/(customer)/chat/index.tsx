import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listConversations } from '@/api/conversations';
import { AppHeader } from '@/components/layout/AppHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { loadCustomerSession } from '@/lib/storage';
import { formatDistanceToNow } from 'date-fns';
import type { CWConversation } from '@/types';

export default function CustomerChatList() {
  const { t } = useTranslation();
  const [contactId, setContactId] = useState<number | undefined>();

  useEffect(() => {
    loadCustomerSession().then((s) => { if (s.contactId) setContactId(s.contactId); });
  }, []);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['customer-conversations', contactId],
    queryFn: () => listConversations({ status: 'open' }),
    enabled: true,
  });

  const conversations = data?.data ?? [];

  function statusColor(status: string) {
    if (status === 'open') return '#48bb78';
    if (status === 'resolved') return '#63b3ed';
    return '#f6ad55';
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title={t('customer.my_chats')} />
      <TouchableOpacity
        onPress={() => router.push('/(customer)/chat/new' as never)}
        className="mx-5 mt-4 mb-2 bg-brand rounded-xl py-3 items-center"
      >
        <Text className="text-white font-bold text-base">+ New Chat</Text>
      </TouchableOpacity>

      {isLoading ? (
        <View className="px-5 gap-3 mt-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState icon="💬" message="No chats yet. Start a new conversation!" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#63b3ed" />}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }: { item: CWConversation }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(customer)/chat/${item.id}` as never)}
              className="bg-surface-card border border-surface-border rounded-xl p-4 flex-row items-center gap-3"
            >
              <View className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: statusColor(item.status) }} />
              <View className="flex-1">
                <Text className="text-text-primary font-medium" numberOfLines={1}>
                  {item.meta?.sender?.name ?? 'Support Chat'}
                </Text>
                <Text className="text-text-muted text-xs" numberOfLines={1}>
                  Chat · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </Text>
              </View>
              <Text className="text-text-muted text-xs capitalize">{item.status}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
