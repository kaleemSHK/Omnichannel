import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
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
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader
        title={t('customer.my_tickets')}
        right={
          <TouchableOpacity
            onPress={() => navigation.navigate('NewTicket')}
            className="ml-2 px-3 py-1 bg-brand rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">+ New</Text>
          </TouchableOpacity>
        }
      />
      {isLoading ? (
        <View className="px-5 gap-3 mt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
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
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#63b3ed" />}
          contentContainerStyle={{ padding: 20, gap: 12 }}
        />
      )}
    </SafeAreaView>
  );
}
