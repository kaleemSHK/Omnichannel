import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n, { applyRTL } from '@/lib/i18n';
import { savePrefs } from '@/lib/storage';
import { useAuthStore } from '@/store/auth';
import { useCallsStore } from '@/store/calls';
import { setAgentState as apiSetAgentState } from '@/api/routing';
import { Avatar } from '@/components/layout/Avatar';
import { AppHeader } from '@/components/layout/AppHeader';
import type { AgentState } from '@/types';

const STATE_OPTIONS: AgentState[] = ['available', 'break', 'busy', 'offline'];

export default function AgentSettings() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const agentState = useCallsStore((s) => s.agentState);
  const setAgentState = useCallsStore((s) => s.setAgentState);
  const sipRegistered = useCallsStore((s) => s.sipRegistered);

  async function changeLang(lang: 'ar' | 'en') {
    await savePrefs({ lang });
    i18n.changeLanguage(lang);
    applyRTL(lang);
  }

  async function handleLogout() {
    await clearAuth();
    router.replace('/auth/select-role');
  }

  async function handleStateChange(state: AgentState) {
    setAgentState(state);
    if (user) {
      try {
        await apiSetAgentState(String(user.id), state);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title={t('agent.settings')} />
      <ScrollView className="flex-1 px-5 py-4">
        <View className="flex-row items-center mb-8 bg-surface-card border border-surface-border rounded-xl p-4">
          <Avatar name={user?.name ?? ''} imageUrl={user?.avatarUrl} size={56} online={sipRegistered} />
          <View className="ml-4 flex-1">
            <Text className="text-text-primary font-bold text-lg">{user?.name}</Text>
            <Text className="text-text-secondary text-sm">{user?.email}</Text>
            <Text className="text-brand text-xs mt-1 capitalize">{user?.role?.replace('_', ' ')}</Text>
          </View>
        </View>

        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">Status</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {STATE_OPTIONS.map((state) => (
            <TouchableOpacity
              key={state}
              onPress={() => handleStateChange(state)}
              className={`px-3 py-2 rounded-full border ${
                agentState === state ? 'bg-brand border-brand' : 'border-surface-border'
              }`}
            >
              <Text className={`text-xs ${agentState === state ? 'text-black font-bold' : 'text-text-secondary'}`}>
                {t(`agent.${state}` as 'agent.available')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">Language</Text>
        <View className="flex-row gap-2 mb-6">
          {(['en', 'ar'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              onPress={() => changeLang(lang)}
              className="flex-1 bg-surface-card border border-surface-border rounded-xl py-3 items-center active:opacity-70"
            >
              <Text className="text-text-primary font-medium">{lang === 'en' ? 'English' : 'العربية'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">SIP</Text>
        <View className="bg-surface-card border border-surface-border rounded-xl p-4 mb-8 flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${sipRegistered ? 'bg-success' : 'bg-danger'}`} />
          <Text className="text-text-primary text-sm">
            {sipRegistered ? 'Registered on WSS' : 'Not registered'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          className="bg-danger/20 border border-danger/40 rounded-xl py-4 items-center active:opacity-70"
        >
          <Text className="text-danger font-bold">{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
