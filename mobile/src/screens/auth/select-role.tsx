import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { savePrefs } from '@/lib/storage';
import { C } from '@/lib/ui';
import type { RootStackParamList } from '@/navigation/types';

export default function SelectRoleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  async function chooseCustomer() {
    await savePrefs({ role: 'customer' });
    navigation.reset({ index: 0, routes: [{ name: 'Customer', state: { routes: [{ name: 'CustomerWelcome' }] } }] });
  }

  async function chooseAgent() {
    await savePrefs({ role: 'agent' });
    navigation.navigate('Auth', { screen: 'Login' });
  }

  return (
    <SafeAreaView style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.logo}>
          <Text style={s.logoText}>B</Text>
        </View>
        <Text style={s.brand}>BlinkOne</Text>
        <Text style={s.tagline}>Contact Center Platform</Text>
      </View>

      {/* Role cards */}
      <View style={s.cards}>
        <TouchableOpacity style={s.card} onPress={chooseCustomer} activeOpacity={0.85}>
          <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
            <Text style={s.icon}>💬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>I need support</Text>
            <Text style={s.cardSub}>Contact our team — call or chat anytime</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.card, s.cardPrimary]} onPress={chooseAgent} activeOpacity={0.85}>
          <View style={[s.iconBox, { backgroundColor: '#DBEAFE' }]}>
            <Text style={s.icon}>🎧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>I'm an agent</Text>
            <Text style={s.cardSub}>Sign in to handle conversations and calls</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.footer}>BlinkOne © 2026 — Enterprise Contact Center</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
  header:      { alignItems: 'center', paddingTop: 60, paddingBottom: 48 },
  logo:        { width: 64, height: 64, borderRadius: 20, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: C.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  logoText:    { color: '#fff', fontSize: 28, fontWeight: '800' },
  brand:       { fontSize: 28, fontWeight: '800', color: C.text, marginBottom: 6 },
  tagline:     { fontSize: 14, color: C.textSub },
  cards:       { gap: 14 },
  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 16 },
  cardPrimary: { borderColor: C.brandLight, borderWidth: 2 },
  iconBox:     { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  icon:        { fontSize: 26 },
  cardTitle:   { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
  cardSub:     { fontSize: 13, color: C.textSub, lineHeight: 18 },
  arrow:       { fontSize: 22, color: C.textMute },
  footer:      { textAlign: 'center', color: C.textMute, fontSize: 12, marginTop: 48 },
});
