import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { startCustomerSession } from '@/api/customer';
import { saveCustomerSession } from '@/lib/storage';
import { C } from '@/lib/ui';
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
      const session = await startCustomerSession({ name: trimmed, email: email.trim() || undefined });
      await saveCustomerSession({
        token: session.token, contactId: session.contactId,
        conversationId: session.conversationId, accountId: session.accountId, name: session.name,
      });
      navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
    } catch (e) {
      Alert.alert('Setup failed', e instanceof Error ? e.message : 'Could not start session.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <View style={s.header}>
          <View style={s.logo}><Text style={s.logoT}>B</Text></View>
          <Text style={s.title}>Welcome to BlinkOne</Text>
          <Text style={s.sub}>Tell us who you are so we can connect your history.</Text>
        </View>
        <View>
          <Text style={s.label}>Your Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Enter your name"
            placeholderTextColor={C.textMute} style={s.input} returnKeyType="next" />
          <Text style={[s.label, { marginTop: 16 }]}>Email (optional)</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com"
            placeholderTextColor={C.textMute} keyboardType="email-address" autoCapitalize="none"
            style={s.input} returnKeyType="done" onSubmitEditing={handleContinue} />
          <TouchableOpacity onPress={handleContinue} disabled={loading}
            style={[s.btn, loading && { opacity: 0.7 }]} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Continue →</Text>}
          </TouchableOpacity>
        </View>
        <Text style={s.footer}>Your conversations are private and secure.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  kav:    { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 36 },
  logo:   { width: 64, height: 64, borderRadius: 20, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  logoT:  { color: '#fff', fontSize: 28, fontWeight: '800' },
  title:  { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  sub:    { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20 },
  label:  { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input:  { backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.text, marginBottom: 4 },
  btn:    { backgroundColor: C.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: C.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnT:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { textAlign: 'center', color: C.textMute, fontSize: 12, marginTop: 32 },
});
