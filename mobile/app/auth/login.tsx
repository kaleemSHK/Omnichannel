import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { loginWithPassword } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { user, tokens } = await loginWithPassword(email.trim(), password);
      await setAuth(user, tokens);
      router.replace('/(agent)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-6"
      >
        <Text className="text-brand text-3xl font-bold mb-1">{t('auth.blinkone')}</Text>
        <Text className="text-text-secondary text-sm mb-10">{t('auth.welcome_back')}</Text>

        <Text className="text-text-secondary text-xs mb-1 uppercase tracking-widest">{t('auth.email')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="agent@company.com"
          placeholderTextColor="#5a6170"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 text-text-primary mb-4"
        />

        <Text className="text-text-secondary text-xs mb-1 uppercase tracking-widest">{t('auth.password')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#5a6170"
          secureTextEntry
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 text-text-primary mb-2"
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        {!!error && <Text className="text-danger text-sm mb-4">{error}</Text>}

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="bg-brand rounded-xl py-4 items-center mt-2 active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-black font-bold text-base">{t('auth.login')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/auth/select-role')} className="mt-6 items-center">
          <Text className="text-text-muted text-sm">← Back</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
