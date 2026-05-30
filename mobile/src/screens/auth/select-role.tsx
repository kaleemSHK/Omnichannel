import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { savePrefs } from '@/lib/storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';

export default function SelectRoleScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  async function chooseCustomer() {
    await savePrefs({ role: 'customer' });
    navigation.reset({
      index: 0,
      routes: [{ name: 'Customer', state: { routes: [{ name: 'CustomerWelcome' }] } }],
    });
  }

  async function chooseAgent() {
    await savePrefs({ role: 'agent' });
    navigation.navigate('Auth', { screen: 'Login' });
  }

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
      <Text className="text-brand text-3xl font-bold mb-2">{t('auth.blinkone')}</Text>
      <Text className="text-text-secondary text-sm mb-12">Contact Center Platform</Text>

      <TouchableOpacity
        onPress={chooseCustomer}
        className="w-full bg-surface-card border border-surface-border rounded-2xl p-6 mb-4 active:opacity-70"
      >
        <Text className="text-4xl mb-3">📱</Text>
        <Text className="text-text-primary text-lg font-bold mb-1">I need support</Text>
        <Text className="text-text-secondary text-sm">Contact our team — call or chat anytime</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={chooseAgent}
        className="w-full bg-surface-card border border-brand/30 rounded-2xl p-6 active:opacity-70"
      >
        <Text className="text-4xl mb-3">🎧</Text>
        <Text className="text-text-primary text-lg font-bold mb-1">I&apos;m an agent</Text>
        <Text className="text-text-secondary text-sm">Sign in to handle conversations and calls</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
