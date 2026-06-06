import { useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { navigate } from '@/navigation/navigationRef';
import { hapticImpact } from '@/lib/haptics';
import { searchContacts, listContacts } from '@/api/contacts';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/layout/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { useSip } from '@/providers/sip-context';
import { useCallsStore } from '@/store/calls';
import { usePermissions } from '@/hooks/usePermissions';
import type { CWContact } from '@/types';
import { useEffect, useRef } from 'react';
import { C } from '@/lib/ui';

export default function AgentContacts() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { makeCall } = useSip();
  const activeCall = useCallsStore((s) => s.activeCall);
  const { requestMic } = usePermissions();

  useEffect(() => {
    if (activeCall) navigate('CallActive');
  }, [activeCall]);

  function onSearchChange(text: string) {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 350);
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['contacts', debouncedSearch],
    queryFn: () =>
      debouncedSearch.trim()
        ? searchContacts(debouncedSearch.trim())
        : listContacts(1),
    staleTime: 30_000,
  });

  const contacts = data?.data ?? [];

  async function callContact(phone: string) {
    const granted = await requestMic();
    if (!granted) {
      Alert.alert('Microphone Required', 'Please grant microphone access to make calls.');
      return;
    }
    hapticImpact('medium');
    void makeCall(phone);
  }

  const renderItem = useCallback(({ item }: { item: CWContact }) => (
    <View style={styles.contactCard}>
      <Avatar name={item.name} imageUrl={item.avatar_url} size={40} />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactSub} numberOfLines={1}>
          {item.email ?? item.phone_number ?? 'No contact info'}
        </Text>
      </View>
      <View style={styles.actionButtons}>
        {item.phone_number && (
          <TouchableOpacity
            onPress={() => callContact(item.phone_number!)}
            style={[styles.actionBtn, { backgroundColor: C.greenBg }]}
          >
            <Text style={styles.actionBtnIcon}>📞</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => navigate('Agent', { screen: 'AgentTabs', params: { screen: 'Conversations' } })}
          style={[styles.actionBtn, { backgroundColor: C.brandLight }]}
        >
          <Text style={styles.actionBtnIcon}>💬</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), []);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title={t('agent.contacts')} />
      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder={t('common.search')}
          placeholderTextColor={C.textMute}
          style={styles.searchInput}
        />
      </View>

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 64, borderRadius: 14 }} />)}
        </View>
      ) : contacts.length === 0 ? (
        <EmptyState icon="👤" message={debouncedSearch ? 'No contacts found' : 'No contacts in this account'} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  contactCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: C.text,
    fontWeight: '500',
  },
  contactSub: {
    color: C.textMute,
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnIcon: {
    fontSize: 18,
  },
});
