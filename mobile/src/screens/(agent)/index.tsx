import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { useCallsStore } from '@/store/calls';
import { useRoutingPresence } from '@/hooks/useRoutingPresence';
import { listConversations } from '@/api/conversations';
import { Five9Header } from '@/components/layout/Five9Header';
import { C } from '@/lib/ui';
import { hapticSelection } from '@/lib/haptics';
import type { AgentState } from '@/types';
import type { AgentStackParamList, AgentTabParamList } from '@/navigation/types';

type AgentNav = CompositeNavigationProp<
  BottomTabNavigationProp<AgentTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<AgentStackParamList>
>;

const STATES: { key: AgentState; label: string; color: string; bg: string }[] = [
  { key: 'available', label: 'Available',  color: C.green,  bg: C.greenBg },
  { key: 'break',     label: 'On Break',   color: C.amber,  bg: C.amberBg },
  { key: 'busy',      label: 'Busy',       color: C.red,    bg: C.redBg },
  { key: 'offline',   label: 'Offline',    color: C.textMute, bg: C.bgMuted },
];

export default function AgentDashboard() {
  const navigation = useNavigation<AgentNav>();
  const user = useAuthStore((s) => s.user);
  const agentState = useCallsStore((s) => s.agentState);
  const { publishState } = useRoutingPresence();
  const [refreshing, setRefreshing] = useState(false);
  const stateInfo = STATES.find((s) => s.key === agentState) ?? STATES[3];

  const { data: openConvs, isLoading, refetch } = useQuery({
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

  async function changeState(state: AgentState) {
    hapticSelection();
    try {
      await publishState(state);
    } catch {
      /* routing unavailable */
    }
  }

  async function onRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const kpis = [
    { label: 'Open', value: openCount, color: C.green, bg: C.greenBg, icon: '💬' },
    { label: 'Pending', value: pendingCount, color: C.amber, bg: C.amberBg, icon: '⏳' },
    { label: 'Unread', value: unreadCount, color: C.red, bg: C.redBg, icon: '🔔' },
  ];

  const quickLinks = [
    { icon: '💬', label: 'Conversations', sub: `${openCount} open`, screen: 'Conversations' as const, color: C.brand, bg: C.brandLight },
    { icon: '📞', label: 'Call History', sub: 'Recent calls', screen: 'Calls' as const, color: '#7C3AED', bg: '#EDE9FE' },
    { icon: '🎯', label: 'Dial Pad', sub: 'Make a call', screen: 'Dial' as const, color: '#0891B2', bg: '#E0F2FE' },
    { icon: '👥', label: 'Contacts', sub: 'Search contacts', screen: 'Contacts' as const, color: '#D97706', bg: '#FEF3C7' },
  ];

  return (
    <View style={s.screen}>
      <Five9Header
        title={user?.name ?? 'Agent'}
        subtitle={user?.email ?? 'Agent workspace'}
        right={
          <View style={[s.statePill, { backgroundColor: stateInfo.bg }]}>
            <View style={[s.stateDot, { backgroundColor: stateInfo.color }]} />
            <Text style={[s.stateLabel, { color: stateInfo.color }]}>{stateInfo.label}</Text>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI cards */}
        <Text style={s.sectionLabel}>MY QUEUES</Text>
        <View style={s.kpiRow}>
          {kpis.map((k) => (
            <View key={k.label} style={[s.kpiCard, { backgroundColor: k.bg }]}>
              <Text style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</Text>
              <Text style={[s.kpiValue, { color: k.color }]}>{isLoading ? '—' : k.value}</Text>
              <Text style={[s.kpiLabel, { color: k.color }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Status selector */}
        <Text style={s.sectionLabel}>SET STATUS</Text>
        <View style={s.stateRow}>
          {STATES.map((opt) => {
            const active = agentState === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => changeState(opt.key)}
                activeOpacity={0.85}
                style={[s.stateBtn, active && { backgroundColor: opt.bg, borderColor: opt.color }]}
              >
                <View style={[s.stateDotSm, { backgroundColor: opt.color }]} />
                <Text style={[s.stateBtnLabel, active && { color: opt.color, fontWeight: '700' }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick links */}
        <Text style={s.sectionLabel}>QUICK ACCESS</Text>
        <View style={s.links}>
          {quickLinks.map((item) => (
            <TouchableOpacity
              key={item.screen}
              onPress={() => { hapticSelection(); navigation.navigate(item.screen); }}
              activeOpacity={0.85}
              style={s.linkCard}
            >
              <View style={[s.linkIcon, { backgroundColor: item.bg }]}>
                <Text style={{ fontSize: 22 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.linkLabel}>{item.label}</Text>
                <Text style={s.linkSub}>{item.sub}</Text>
              </View>
              <Text style={s.linkArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  scroll:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  statePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  stateDot:     { width: 8, height: 8, borderRadius: 4 },
  stateLabel:   { fontSize: 12, fontWeight: '600' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textMute, letterSpacing: 1, marginBottom: 10, marginTop: 8 },
  kpiRow:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  kpiCard:      { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  kpiValue:     { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  kpiLabel:     { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  stateRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  stateBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard },
  stateDotSm:   { width: 8, height: 8, borderRadius: 4 },
  stateBtnLabel:{ fontSize: 13, color: C.textSub },
  links:        { gap: 10 },
  linkCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, gap: 14 },
  linkIcon:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  linkLabel:    { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },
  linkSub:      { fontSize: 12, color: C.textSub },
  linkArrow:    { fontSize: 22, color: C.textMute },
});
