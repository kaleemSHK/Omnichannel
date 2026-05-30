import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { listConversations } from '@/api/conversations';
import { Avatar } from '@/components/layout/Avatar';
import { C } from '@/lib/ui';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import type { CWConversation } from '@/types';
import type { AgentStackParamList, AgentTabParamList } from '@/navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AgentTabParamList, 'Conversations'>,
  NativeStackNavigationProp<AgentStackParamList>
>;

type StatusFilter = 'open' | 'resolved' | 'pending';
const ST = {
  open:     { color: C.green, bg: C.greenBg,   label: 'Open' },
  resolved: { color: C.brand, bg: C.brandLight, label: 'Resolved' },
  pending:  { color: C.amber, bg: C.amberBg,   label: 'Pending' },
};
const CH: Record<string, string> = { web_widget: '💬', email: '📧', whatsapp: '📱', api: '🔗', voice: '📞' };

function ConvCard({ item, onPress }: { item: CWConversation; onPress: () => void }) {
  const sender = item.meta.sender;
  const st = ST[item.status as keyof typeof ST] ?? ST.open;
  const ch = CH[item.channel ?? 'web_widget'] ?? '💬';
  const time = formatDistanceToNow(item.last_activity_at * 1000, { addSuffix: true });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.card}>
      <View>
        <Avatar name={sender.name} imageUrl={sender.avatar} size={46} online={item.status === 'open'} />
        <View style={s.ch}><Text style={{ fontSize: 10 }}>{ch}</Text></View>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={s.row}>
          <Text style={s.name} numberOfLines={1}>{sender.name}</Text>
          <Text style={s.time}>{time}</Text>
        </View>
        <View style={s.row}>
          <View style={[s.pill, { backgroundColor: st.bg }]}>
            <Text style={[s.pillT, { color: st.color }]}>{st.label}</Text>
          </View>
          {item.unread_count > 0 && (
            <View style={s.badge}><Text style={s.badgeT}>{item.unread_count}</Text></View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AgentConversations() {
  const navigation = useNavigation<Nav>();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['conversations', status],
    queryFn: () => listConversations({ status }),
    staleTime: 15_000,
  });
  const conversations = (data?.data ?? []).filter(
    (c: CWConversation) => !search || c.meta.sender.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Conversations</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={C.textMute} style={s.search} />
        <View style={s.filters}>
          {(['open', 'pending', 'resolved'] as StatusFilter[]).map((f) => (
            <TouchableOpacity key={f} onPress={() => setStatus(f)} activeOpacity={0.85} style={[s.fil, status === f && s.filOn]}>
              <Text style={[s.filT, status === f && s.filTOn]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {isLoading ? (
        <View style={{ padding: 16, gap: 8 }}>{[1,2,3,4].map(i => <View key={i} style={s.skel} />)}</View>
      ) : conversations.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
          <Text style={s.emptyH}>No {status} conversations</Text>
          <Text style={s.emptyS}>Pull down to refresh</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ConvCard item={item} onPress={() => navigation.navigate('ConversationDetail', { conversationId: item.id })} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  header:  { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  title:   { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 12 },
  search:  { backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text, marginBottom: 10 },
  filters: { flexDirection: 'row', gap: 8 },
  fil:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border },
  filOn:   { backgroundColor: C.brand, borderColor: C.brand },
  filT:    { fontSize: 13, color: C.textSub, fontWeight: '500' },
  filTOn:  { color: '#fff', fontWeight: '700' },
  skel:    { height: 72, borderRadius: 16, backgroundColor: C.bgMuted },
  empty:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyH:  { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyS:  { fontSize: 14, color: C.textSub, textAlign: 'center' },
  card:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  ch:      { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name:    { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  time:    { fontSize: 11, color: C.textMute },
  pill:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillT:   { fontSize: 11, fontWeight: '600' },
  badge:   { backgroundColor: C.red, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeT:  { color: '#fff', fontSize: 10, fontWeight: '800' },
});
