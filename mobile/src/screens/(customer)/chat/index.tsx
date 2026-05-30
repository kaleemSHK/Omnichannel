import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/AppHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { loadCustomerSession } from '@/lib/storage';
import type { CustomerStackParamList } from '@/navigation/types';
import { C } from '@/lib/ui';

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
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title={t('customer.my_chats')} />
      <TouchableOpacity
        onPress={() => navigation.navigate('ChatDetail', { id: 'new' })}
        style={styles.newChatBtn}
      >
        <Text style={styles.newChatText}>+ New Chat</Text>
      </TouchableOpacity>

      {conversationId ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('ChatDetail', { id: String(conversationId) })}
          style={styles.existingChat}
        >
          <Text style={styles.existingChatTitle}>Support Chat</Text>
          <Text style={styles.existingChatSub}>Tap to continue your conversation</Text>
        </TouchableOpacity>
      ) : (
        <EmptyState icon="💬" message="No chats yet. Start a new conversation!" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  newChatBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  newChatText: {
    color: C.textWhite,
    fontWeight: '700',
    fontSize: 16,
  },
  existingChat: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
  },
  existingChatTitle: {
    color: C.text,
    fontWeight: '500',
  },
  existingChatSub: {
    color: C.textMute,
    fontSize: 12,
    marginTop: 4,
  },
});
