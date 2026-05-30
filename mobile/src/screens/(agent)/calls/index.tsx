import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listCDR } from '@/api/calls';
import { AppHeader } from '@/components/layout/AppHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDistanceToNow } from 'date-fns';
import { C } from '@/lib/ui';

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
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title={t('agent.calls')} />
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 64, borderRadius: 14 }} />
          ))}
        </View>
      ) : records.length === 0 ? (
        <EmptyState icon="📋" message="No call history yet" />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} />}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => (
            <View style={styles.cdrCard}>
              <Text style={styles.cdrIcon}>{item.direction === 'inbound' ? '📲' : '📞'}</Text>
              <View style={styles.cdrInfo}>
                <Text style={styles.cdrAgent}>{item.agentId || 'Unknown'}</Text>
                <Text style={styles.cdrOutcome}>{item.outcome}</Text>
              </View>
              <View style={styles.cdrRight}>
                <Text style={styles.cdrDuration}>{formatDuration(item.duration)}</Text>
                <Text style={styles.cdrTime}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 16,
  },
  cdrCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cdrIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cdrInfo: {
    flex: 1,
  },
  cdrAgent: {
    color: C.text,
    fontWeight: '500',
  },
  cdrOutcome: {
    color: C.textMute,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  cdrRight: {
    alignItems: 'flex-end',
  },
  cdrDuration: {
    color: C.textSub,
    fontSize: 14,
  },
  cdrTime: {
    color: C.textMute,
    fontSize: 12,
  },
});
