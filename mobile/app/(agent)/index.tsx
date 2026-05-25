import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { useCallsStore } from '@/store/calls';
import { setAgentState as apiSetAgentState } from '@/api/routing';
import { IncomingCallSheet } from '@/components/calling/IncomingCallSheet';
import { ActiveCallBar } from '@/components/calling/ActiveCallBar';
import { Avatar } from '@/components/layout/Avatar';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import type { AgentState } from '@/types';

const STATE_OPTIONS: { key: AgentState; label: string; color: string }[] = [
  { key: 'available', label: 'agent.available', color: '#48bb78' },
  { key: 'break', label: 'agent.break', color: '#f6ad55' },
  { key: 'busy', label: 'agent.busy', color: '#fc8181' },
  { key: 'offline', label: 'agent.offline', color: '#5a6170' },
];

export default function AgentDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const agentState = useCallsStore((s) => s.agentState);
  const setAgentState = useCallsStore((s) => s.setAgentState);
  const incomingCalls = useCallsStore((s) => s.incomingCalls);
  const activeCall = useCallsStore((s) => s.activeCall);

  async function handleStateChange(state: AgentState) {
    setAgentState(state);
    try {
      if (user) await apiSetAgentState(String(user.id), state);
    } catch {
      /* local state updated */
    }
  }

  const stateInfo = STATE_OPTIONS.find((s) => s.key === agentState) ?? STATE_OPTIONS[3];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <OfflineBanner />
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
        <View className="flex-row items-center mb-6">
          <Avatar name={user?.name ?? ''} imageUrl={user?.avatarUrl} size={44} />
          <View className="ml-3 flex-1">
            <Text className="text-text-primary font-bold text-base">{user?.name}</Text>
            <Text className="text-text-secondary text-sm">{user?.email}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 bg-surface-card border border-surface-border rounded-full px-3 py-1.5">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: stateInfo.color }} />
            <Text className="text-text-primary text-xs font-medium">{t(stateInfo.label)}</Text>
          </View>
        </View>

        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">My Status</Text>
        <View className="flex-row gap-2 mb-6 flex-wrap">
          {STATE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => handleStateChange(opt.key)}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full border ${
                agentState === opt.key ? 'border-transparent bg-surface' : 'border-surface-border bg-transparent'
              }`}
            >
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
              <Text
                className={`text-xs font-medium ${
                  agentState === opt.key ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {t(opt.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">Quick Access</Text>
        <View className="gap-3 mb-6">
          {[
            { icon: '💬', label: 'Conversations', route: '/(agent)/conversations' },
            { icon: '📋', label: 'Call History', route: '/(agent)/calls' },
            { icon: '⚙️', label: 'Settings', route: '/(agent)/settings' },
          ].map((item) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => router.push(item.route as never)}
              className="flex-row items-center bg-surface-card border border-surface-border rounded-xl p-4 active:opacity-70"
            >
              <Text className="text-2xl mr-4">{item.icon}</Text>
              <Text className="text-text-primary font-medium flex-1">{item.label}</Text>
              <Text className="text-text-muted">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {activeCall ? <ActiveCallBar /> : null}
      {incomingCalls.length > 0 ? <IncomingCallSheet /> : null}
    </SafeAreaView>
  );
}
