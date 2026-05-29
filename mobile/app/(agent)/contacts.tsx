import { useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { searchContacts } from '@/api/contacts';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/layout/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { useSip } from '@/providers/sip-context';
import { useCallsStore } from '@/store/calls';
import { usePermissions } from '@/hooks/usePermissions';
import type { CWContact } from '@/types';
import { useEffect, useRef } from 'react';

export default function AgentContacts() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { makeCall } = useSip();
  const activeCall = useCallsStore((s) => s.activeCall);
  const { requestMic } = usePermissions();

  useEffect(() => {
    if (activeCall) router.push('/call-active');
  }, [activeCall]);

  function onSearchChange(text: string) {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 350);
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['contacts', debouncedSearch],
    queryFn: () => searchContacts(debouncedSearch || 'a'),
    staleTime: 30_000,
  });

  const contacts = data?.data ?? [];

  async function callContact(phone: string) {
    const granted = await requestMic();
    if (!granted) {
      Alert.alert('Microphone Required', 'Please grant microphone access to make calls.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    makeCall(phone);
  }

  const renderItem = useCallback(({ item }: { item: CWContact }) => (
    <View className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex-row items-center gap-3">
      <Avatar name={item.name} imageUrl={item.avatar_url} size={40} />
      <View className="flex-1">
        <Text className="text-text-primary font-medium">{item.name}</Text>
        <Text className="text-text-muted text-xs" numberOfLines={1}>
          {item.email ?? item.phone_number ?? 'No contact info'}
        </Text>
      </View>
      <View className="flex-row gap-2">
        {item.phone_number && (
          <TouchableOpacity
            onPress={() => callContact(item.phone_number!)}
            className="w-9 h-9 rounded-full bg-green-900/30 items-center justify-center"
          >
            <Text className="text-lg">📞</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => router.push(`/(agent)/conversations?contact=${item.id}` as never)}
          className="w-9 h-9 rounded-full bg-blue-900/30 items-center justify-center"
        >
          <Text className="text-lg">💬</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), []);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title={t('agent.contacts')} />
      <View className="px-5 py-3">
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder={t('common.search')}
          placeholderTextColor="#5a6170"
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-2.5 text-text-primary"
        />
      </View>

      {isLoading ? (
        <View className="px-5 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </View>
      ) : contacts.length === 0 ? (
        <EmptyState icon="👤" message={debouncedSearch ? 'No contacts found' : 'Search for contacts'} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#63b3ed" />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}
        />
      )}
    </SafeAreaView>
  );
}
