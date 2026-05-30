import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginWithPassword } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { C } from '@/lib/ui';
import type { RootStackParamList } from '@/navigation/types';

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Please enter your email and password'); return; }
    setLoading(true); setError('');
    try {
      const { user, tokens } = await loginWithPassword(email.trim(), password);
      await setAuth(user, tokens);
      navigation.reset({ index: 0, routes: [{ name: 'Agent' }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        {/* Logo */}
        <View style={s.logoRow}>
          <View style={s.logoBox}><Text style={s.logoLetter}>B</Text></View>
          <View>
            <Text style={s.brand}>BlinkOne</Text>
            <Text style={s.sub}>Agent Sign In</Text>
          </View>
        </View>

        {/* Email */}
        <Text style={s.label}>Email Address</Text>
        <TextInput
          value={email} onChangeText={setEmail}
          placeholder="agent@company.com"
          placeholderTextColor={C.textMute}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          style={s.input}
        />

        {/* Password */}
        <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
        <TextInput
          value={password} onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={C.textMute}
          secureTextEntry
          style={s.input}
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠ {error}</Text>
          </View>
        )}

        {/* Sign in button */}
        <TouchableOpacity onPress={handleLogin} disabled={loading} style={[s.btn, loading && s.btnDisabled]} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>

        {/* Back */}
        <TouchableOpacity onPress={() => navigation.navigate('Auth', { screen: 'SelectRole' })} style={s.back}>
          <Text style={s.backText}>← Back to role selection</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: C.bg },
  kav:      { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 40 },
  logoBox:  { width: 52, height: 52, borderRadius: 16, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', shadowColor: C.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  logoLetter:{ color: '#fff', fontSize: 24, fontWeight: '800' },
  brand:    { fontSize: 22, fontWeight: '800', color: C.text },
  sub:      { fontSize: 13, color: C.textSub, marginTop: 2 },
  label:    { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input:    { backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.text, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText:{ color: C.red, fontSize: 13 },
  btn:      { backgroundColor: C.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: C.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnDisabled:{ opacity: 0.7 },
  btnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  back:     { alignItems: 'center', marginTop: 24 },
  backText: { color: C.textSub, fontSize: 14 },
});
