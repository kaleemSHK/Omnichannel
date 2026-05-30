import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/AppHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { loadCustomerSession } from '@/lib/storage';
import type { CustomerStackParamList } from '@/navigation/types';

export default function CustomerChatList() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const [conversationId, setConversationId] = useState<number | null>(null);

  useEffect(() => {
    loadCustomerSession().then((s) => {
      if (s.conversationId) setConversationId(s.conversationId);
    });
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title={t('customer.my_chats')} />
      <TouchableOpacity
        onPress={() => navigation.navigate('ChatDetail', { id: 'new' })}
        className="mx-5 mt-4 mb-2 bg-brand rounded-xl py-3 items-center"
      >
        <Text className="text-white font-bold text-base">+ New Chat</Text>
      </TouchableOpacity>

      {conversationId ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('ChatDetail', { id: String(conversationId) })}
          className="mx-5 mt-2 bg-surface-card border border-surface-border rounded-xl p-4"
        >
          <Text className="text-text-primary font-medium">Support Chat</Text>
          <Text className="text-text-muted text-xs mt-1">Tap to continue your conversation</Text>
        </TouchableOpacity>
      ) : (
        <EmptyState icon="💬" message="No chats yet. Start a new conversation!" />
      )}
    </SafeAreaView>
  );
}
