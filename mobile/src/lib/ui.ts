// Five9-inspired enterprise contact center design tokens
import { StyleSheet, Platform } from 'react-native';

export const C = {
  // Surfaces
  bg: '#F0F3F7',
  bgCard: '#FFFFFF',
  bgMuted: '#E8EDF3',
  bgBlue: '#E6F2FF',
  bgNavy: '#0A2540',

  // Five9-style brand blues
  brand: '#0073E6',
  brandDark: '#005BB5',
  brandLight: '#CCE4FF',
  navy: '#0A2540',
  navyMid: '#143D66',

  // Text
  text: '#1A2332',
  textSub: '#4A5568',
  textMute: '#8B95A5',
  textWhite: '#FFFFFF',

  // Status (agent presence)
  green: '#0E9F6E',
  greenBg: '#D1FAE5',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  red: '#DC2626',
  redBg: '#FEE2E2',
  purple: '#6366F1',
  purpleBg: '#EEF2FF',

  border: '#D8DEE8',
  divider: '#E8EDF3',

  shadow: {
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  r: { sm: 8, md: 12, lg: 16, xl: 20, full: 999 },
} as const;

/** Shared bottom tab bar — light Five9-style chrome */
export const tabBarScreenOptions = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: C.bgCard,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
    ...C.shadow,
  },
  tabBarActiveTintColor: C.brand,
  tabBarInactiveTintColor: C.textMute,
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 2,
  },
};

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: C.r.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardSm: {
    backgroundColor: C.bgCard,
    borderRadius: C.r.md,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 24, fontWeight: '800' as const, color: C.text },
  h2: { fontSize: 18, fontWeight: '700' as const, color: C.text },
  h3: { fontSize: 15, fontWeight: '600' as const, color: C.text },
  body: { fontSize: 14, color: C.textSub, lineHeight: 20 },
  caption: { fontSize: 12, color: C.textMute },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: C.r.full },
  btn: {
    backgroundColor: C.brand,
    borderRadius: C.r.md,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  btnText: { color: C.textWhite, fontSize: 15, fontWeight: '700' as const },
  input: {
    backgroundColor: C.bgCard,
    borderRadius: C.r.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  divLine: { height: 1, backgroundColor: C.divider, marginVertical: 8 },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: C.textMute,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
});
