import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listCDR } from '@/api/calls';
import { AppHeader } from '@/components/layout/AppHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDistanceToNow } from 'date-fns';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AgentCallsHistory() {
  const { t } = useTranslation();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cdr'],
    queryFn: () => listCDR({ page: 1 }),
  });

  const records = data?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title={t('agent.calls')} />
      {isLoading ? (
        <View className="px-5 gap-3 mt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </View>
      ) : records.length === 0 ? (
        <EmptyState icon="📋" message="No call history yet" />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#63b3ed" />}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => (
            <View className="bg-surface-card border border-surface-border rounded-xl p-4 flex-row items-center">
              <Text className="text-2xl mr-3">{item.direction === 'inbound' ? '📲' : '📞'}</Text>
              <View className="flex-1">
                <Text className="text-text-primary font-medium">{item.agentId || 'Unknown'}</Text>
                <Text className="text-text-muted text-xs capitalize">{item.outcome}</Text>
              </View>
              <View className="items-end">
                <Text className="text-text-secondary text-sm">{formatDuration(item.duration)}</Text>
                <Text className="text-text-muted text-xs">
                  {formatDistanceToNow(new Date(item.startedAt), { addSuffix: true })}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
