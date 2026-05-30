import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listConversations } from '@/api/conversations';
import type { CWConversation } from '@/types';
import { ConversationCard } from '@/components/conversations/ConversationCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import type { AgentStackParamList } from '@/navigation/types';
import { useState } from 'react';

type StatusFilter = 'open' | 'resolved' | 'pending';

export default function AgentConversations() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AgentStackParamList>>();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['conversations', status],
    queryFn: () => listConversations({ status }),
    staleTime: 15_000,
  });

  const conversations = (data?.data ?? []).filter(
    (c: CWConversation) =>
      !search || c.meta.sender.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-text-primary text-xl font-bold mb-3">{t('agent.conversations')}</Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('common.search')}
          placeholderTextColor="#5a6170"
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-2.5 text-text-primary mb-3"
        />

        <View className="flex-row gap-2">
          {(['open', 'pending', 'resolved'] as StatusFilter[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatus(s)}
              className={`px-4 py-1.5 rounded-full border ${
                status === s ? 'bg-brand border-brand' : 'border-surface-border bg-transparent'
              }`}
            >
              <Text
                className={`text-xs font-medium capitalize ${
                  status === s ? 'text-black' : 'text-text-secondary'
                }`}
              >
                {t(`conv.${s}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="px-5 gap-3 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState icon="💬" message={t('conv.no_conversations')} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ConversationCard
              conversation={item}
              onPress={() => navigation.navigate('ConversationDetail', { id: String(item.id) })}
            />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#63b3ed" />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
        />
      )}
    </SafeAreaView>
  );
}
