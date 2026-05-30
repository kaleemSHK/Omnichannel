import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { C } from '@/lib/ui';

import type { RootStackParamList } from '@/navigation/types';

const STATE_OPTIONS: AgentState[] = ['available', 'break', 'busy', 'offline'];

export default function AgentSettings() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
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
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title={t('agent.settings')} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <Avatar name={user?.name ?? ''} imageUrl={user?.avatarUrl} size={56} online={sipRegistered} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profileRole}>{user?.role?.replace('_', ' ')}</Text>
          </View>
        </View>

        {/* Status */}
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.stateRow}>
          {STATE_OPTIONS.map((state) => {
            const active = agentState === state;
            return (
              <TouchableOpacity
                key={state}
                onPress={() => handleStateChange(state)}
                style={[styles.stateChip, active ? styles.stateChipActive : styles.stateChipInactive]}
              >
                <Text style={[styles.stateChipText, active ? styles.stateChipTextActive : styles.stateChipTextInactive]}>
                  {t(`agent.${state}` as 'agent.available')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Language */}
        <Text style={styles.sectionLabel}>Language</Text>
        <View style={styles.langRow}>
          {(['en', 'ar'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              onPress={() => changeLang(lang)}
              style={styles.langBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.langText}>{lang === 'en' ? 'English' : 'العربية'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SIP */}
        <Text style={styles.sectionLabel}>SIP</Text>
        <View style={styles.sipCard}>
          <View style={[styles.sipDot, { backgroundColor: sipRegistered ? C.green : C.red }]} />
          <Text style={styles.sipText}>
            {sipRegistered ? 'Registered on WSS' : 'Not registered'}
          </Text>
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <Text style={styles.logoutText}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    color: C.text,
    fontWeight: '700',
    fontSize: 18,
  },
  profileEmail: {
    color: C.textSub,
    fontSize: 14,
  },
  profileRole: {
    color: C.brand,
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  sectionLabel: {
    color: C.textMute,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  stateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  stateChipActive: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  stateChipInactive: {
    backgroundColor: 'transparent',
    borderColor: C.border,
  },
  stateChipText: {
    fontSize: 12,
  },
  stateChipTextActive: {
    color: C.textWhite,
    fontWeight: '700',
  },
  stateChipTextInactive: {
    color: C.textSub,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  langBtn: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  langText: {
    color: C.text,
    fontWeight: '500',
  },
  sipCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sipText: {
    color: C.text,
    fontSize: 14,
  },
  logoutBtn: {
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: C.red,
    fontWeight: '700',
  },
});
