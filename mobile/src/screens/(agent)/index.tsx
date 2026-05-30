import { View, Text, ScrollView, TouchableOpacity, Animated, RefreshControl } from 'react-native';
import { useRef, useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { useAuthStore } from '@/store/auth';
import { useCallsStore } from '@/store/calls';
import { setAgentState as apiSetAgentState } from '@/api/routing';
import { listConversations } from '@/api/conversations';
import { Avatar } from '@/components/layout/Avatar';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import type { AgentState } from '@/types';
import type { AgentStackParamList, AgentTabParamList } from '@/navigation/types';

type AgentNav = CompositeNavigationProp<
  BottomTabNavigationProp<AgentTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<AgentStackParamList>
>;

const STATE_OPTIONS: { key: AgentState; label: string; color: string; emoji: string }[] = [
  { key: 'available', label: 'agent.available', color: '#48bb78', emoji: '🟢' },
  { key: 'break',     label: 'agent.break',     color: '#f6ad55', emoji: '🟡' },
  { key: 'busy',      label: 'agent.busy',      color: '#fc8181', emoji: '🔴' },
  { key: 'offline',   label: 'agent.offline',   color: '#5a6170', emoji: '⚫' },
];

function KPICard({ label, value, color, icon, loading }: {
  label: string; value: string | number; color: string; icon: string; loading?: boolean;
}) {
  const scale = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, delay: 50 }).start();
  }, [scale]);
  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <View className="bg-surface-card border border-surface-border rounded-2xl p-4">
        <Text style={{ fontSize: 22, marginBottom: 6 }}>{icon}</Text>
        {loading ? (
          <View className="h-7 w-10 bg-surface rounded-lg mb-1" />
        ) : (
          <Text style={{ color, fontSize: 26, fontWeight: '800', marginBottom: 2 }}>{value}</Text>
        )}
        <Text className="text-text-muted" style={{ fontSize: 11 }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

export default function AgentDashboard() {
  const { t } = useTranslation();
  const navigation = useNavigation<AgentNav>();
  const user = useAuthStore((s) => s.user);
  const agentState = useCallsStore((s) => s.agentState);
  const setAgentState = useCallsStore((s) => s.setAgentState);
  const [refreshing, setRefreshing] = useState(false);
  const stateInfo = STATE_OPTIONS.find((s) => s.key === agentState) ?? STATE_OPTIONS[3];

  const { data: openConvs, isLoading: convLoading, refetch } = useQuery({
    queryKey: ['conversations', 'open'],
    queryFn: () => listConversations({ status: 'open' }),
    staleTime: 30_000,
  });
  const { data: pendingConvs } = useQuery({
    queryKey: ['conversations', 'pending'],
    queryFn: () => listConversations({ status: 'pending' }),
    staleTime: 30_000,
  });

  const openCount = openConvs?.data?.length ?? 0;
  const pendingCount = pendingConvs?.data?.length ?? 0;
  const unreadCount = (openConvs?.data ?? []).reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  async function handleStateChange(state: AgentState) {
    hapticSelection();
    setAgentState(state);
    try {
      if (user) await apiSetAgentState(String(user.id), state);
    } catch { /* local state updated */ }
  }

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <OfflineBanner />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#63b3ed" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Avatar name={user?.name ?? ''} imageUrl={user?.avatarUrl} size={48} online={agentState === 'available'} />
          <View className="ml-3 flex-1">
            <Text className="text-text-primary font-bold text-base">{user?.name ?? 'Agent'}</Text>
            <Text className="text-text-muted text-xs">{user?.email}</Text>
          </View>
          {/* Status pill */}
          <TouchableOpacity
            onPress={() => {
              const next = STATE_OPTIONS[(STATE_OPTIONS.findIndex(s => s.key === agentState) + 1) % STATE_OPTIONS.length];
              handleStateChange(next.key);
            }}
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border"
            style={{ borderColor: stateInfo.color + '44', backgroundColor: stateInfo.color + '18' }}
          >
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: stateInfo.color }} />
            <Text style={{ color: stateInfo.color, fontSize: 12, fontWeight: '600' }}>{t(stateInfo.label)}</Text>
          </TouchableOpacity>
        </View>

        {/* KPI Cards */}
        <Text className="text-text-muted text-xs uppercase tracking-widest mb-3">My Queues</Text>
        <View className="flex-row gap-3 mb-6">
          <KPICard label="Open" value={openCount} color="#48bb78" icon="💬" loading={convLoading} />
          <KPICard label="Pending" value={pendingCount} color="#f6ad55" icon="⏳" loading={convLoading} />
          <KPICard label="Unread" value={unreadCount} color="#fc8181" icon="🔔" loading={convLoading} />
        </View>

        {/* Status selector */}
        <Text className="text-text-muted text-xs uppercase tracking-widest mb-3">Set Status</Text>
        <View className="flex-row gap-2 mb-6 flex-wrap">
          {STATE_OPTIONS.map((opt) => {
            const active = agentState === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handleStateChange(opt.key)}
                className="flex-row items-center gap-2 px-4 py-2.5 rounded-2xl border"
                style={{
                  borderColor: active ? opt.color : 'rgba(255,255,255,0.08)',
                  backgroundColor: active ? opt.color + '20' : 'transparent',
                }}
              >
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                <Text style={{ color: active ? opt.color : '#9099aa', fontSize: 13, fontWeight: active ? '700' : '400' }}>
                  {t(opt.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick access */}
        <Text className="text-text-muted text-xs uppercase tracking-widest mb-3">Quick Access</Text>
        <View className="gap-2.5">
          {[
            { icon: '💬', label: 'Conversations', sub: `${openCount} open`, screen: 'Conversations' as const, color: '#48bb78' },
            { icon: '📞', label: 'Call History', sub: 'Recent calls', screen: 'Calls' as const, color: '#63b3ed' },
            { icon: '🎯', label: 'Dial Pad', sub: 'Make a call', screen: 'Dial' as const, color: '#a78bfa' },
            { icon: '👥', label: 'Contacts', sub: 'Search contacts', screen: 'Contacts' as const, color: '#f6ad55' },
          ].map((item) => {
            const scale = useRef(new Animated.Value(1)).current;
            return (
              <Animated.View key={item.screen} style={{ transform: [{ scale }] }}>
                <TouchableOpacity
                  onPress={() => { hapticSelection(); navigation.navigate(item.screen); }}
                  onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start()}
                  onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
                  activeOpacity={1}
                  className="flex-row items-center bg-surface-card border border-surface-border rounded-2xl p-4"
                >
                  <View className="w-11 h-11 rounded-2xl items-center justify-center mr-4"
                    style={{ backgroundColor: item.color + '18' }}>
                    <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-primary font-semibold text-sm">{item.label}</Text>
                    <Text className="text-text-muted text-xs mt-0.5">{item.sub}</Text>
                  </View>
                  <Text className="text-text-muted text-lg">›</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
