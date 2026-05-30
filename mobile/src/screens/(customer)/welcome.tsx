import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { startCustomerSession } from '@/api/customer';
import { saveCustomerSession } from '@/lib/storage';
import type { CustomerStackParamList } from '@/navigation/types';

export default function CustomerWelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    const trimmed = name.trim() || 'Mobile Customer';
    setLoading(true);
    try {
      const session = await startCustomerSession({
        name: trimmed,
        email: email.trim() || undefined,
      });
      await saveCustomerSession({
        token: session.token,
        contactId: session.contactId,
        conversationId: session.conversationId,
        accountId: session.accountId,
        name: session.name,
      });
      navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
    } catch (e) {
      Alert.alert(
        'Setup failed',
        e instanceof Error ? e.message : 'Could not start customer session. Check gateway CUSTOMER_CHATWOOT_TOKEN.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg px-6 justify-center">
      <Text className="text-brand text-3xl font-bold mb-2">Welcome</Text>
      <Text className="text-text-secondary text-sm mb-8">
        Tell us who you are so we can connect your tickets and chat history.
      </Text>

      <Text className="text-text-muted text-xs uppercase tracking-widest mb-1">Your name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor="#5a6170"
        className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-text-primary mb-4"
      />

      <Text className="text-text-muted text-xs uppercase tracking-widest mb-1">Email (optional)</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#5a6170"
        keyboardType="email-address"
        autoCapitalize="none"
        className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-text-primary mb-8"
      />

      <TouchableOpacity
        onPress={handleContinue}
        disabled={loading}
        className="bg-brand rounded-xl py-4 items-center"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-base">Continue</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
