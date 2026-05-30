// Central design tokens — inline styles bypass NativeWind build issues
import { StyleSheet } from 'react-native';

export const C = {
  // Backgrounds
  bg:       '#F8FAFC',
  bgCard:   '#FFFFFF',
  bgMuted:  '#F1F5F9',
  bgBlue:   '#EFF6FF',

  // Brand
  brand:    '#2563EB',
  brandDark:'#1D4ED8',
  brandLight:'#DBEAFE',

  // Text
  text:     '#0F172A',
  textSub:  '#475569',
  textMute: '#94A3B8',
  textWhite:'#FFFFFF',

  // Status
  green:    '#16A34A',
  greenBg:  '#DCFCE7',
  amber:    '#D97706',
  amberBg:  '#FEF3C7',
  red:      '#DC2626',
  redBg:    '#FEE2E2',
  purple:   '#7C3AED',
  purpleBg: '#EDE9FE',

  // Border / divider
  border:   '#E2E8F0',
  divider:  '#F1F5F9',

  // Shadow
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Radius
  r: { sm: 8, md: 12, lg: 16, xl: 20, full: 999 },
} as const;

export const S = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: C.bg },
  card:     { backgroundColor: C.bgCard, borderRadius: C.r.xl, padding: 16, borderWidth: 1, borderColor: C.border },
  cardSm:   { backgroundColor: C.bgCard, borderRadius: C.r.lg, padding: 12, borderWidth: 1, borderColor: C.border },
  row:      { flexDirection: 'row', alignItems: 'center' },
  center:   { alignItems: 'center', justifyContent: 'center' },
  h1:       { fontSize: 24, fontWeight: '800' as const, color: C.text },
  h2:       { fontSize: 18, fontWeight: '700' as const, color: C.text },
  h3:       { fontSize: 15, fontWeight: '600' as const, color: C.text },
  body:     { fontSize: 14, color: C.textSub, lineHeight: 20 },
  caption:  { fontSize: 12, color: C.textMute },
  badge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: C.r.full },
  btn:      { backgroundColor: C.brand, borderRadius: C.r.lg, paddingVertical: 14, alignItems: 'center' as const },
  btnText:  { color: C.textWhite, fontSize: 15, fontWeight: '700' as const },
  input:    { backgroundColor: C.bgMuted, borderRadius: C.r.md, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  divLine:  { height: 1, backgroundColor: C.divider, marginVertical: 8 },
  label:    { fontSize: 11, fontWeight: '600' as const, color: C.textMute, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 },
});
