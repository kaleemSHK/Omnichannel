import { FlatList, RefreshControl, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/AppHeader';
import { TicketCard } from '@/components/tickets/TicketCard';
import { EmptyState } from '@/components/layout/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTickets } from '@/hooks/useTickets';
import { loadCustomerSession } from '@/lib/storage';
import { useEffect, useState } from 'react';
import type { CustomerStackParamList } from '@/navigation/types';
import { C } from '@/lib/ui';

export default function CustomerTickets() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const [contactId, setContactId] = useState<number | undefined>();

  useEffect(() => {
    loadCustomerSession().then((s) => setContactId(s.contactId));
  }, []);

  const { data, isLoading, refetch, isRefetching } = useTickets(contactId);
  const tickets = data?.data ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader
        title={t('customer.my_tickets')}
        right={
          <TouchableOpacity
            onPress={() => navigation.navigate('NewTicket')}
            style={styles.newBtn}
          >
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        }
      />
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 80, borderRadius: 12 }} />
          ))}
        </View>
      ) : tickets.length === 0 ? (
        <EmptyState icon="🎫" message={t('ticket.no_tickets')} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => navigation.navigate('TicketDetail', { id: item.id })}
            />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} />}
          contentContainerStyle={{ padding: 20, gap: 12 }}
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
  newBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: C.brand,
    borderRadius: 8,
  },
  newBtnText: {
    color: C.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 16,
  },
});
