import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { C } from '@/lib/ui';

/** Five9-style call screen — navy background, blue accent */
export const CallTheme = {
  bg: C.navy,
  bgSoft: C.navyMid,
  accent: C.brand,
  text: '#FFFFFF',
  textMute: 'rgba(255,255,255,0.65)',
  red: '#E53935',
  redDark: '#C62828',
};

type Props = {
  title: string;
  subtitle: string;
  statusLabel: string;
  statusColor?: string;
  avatarLabel?: string;
  pulse?: boolean;
  children?: React.ReactNode;
  onEndCall?: () => void;
  endLabel?: string;
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
};

export function CallScreenLayout({
  title,
  subtitle,
  statusLabel,
  statusColor = CallTheme.accent,
  avatarLabel,
  pulse = false,
  children,
  onEndCall,
  endLabel = 'End call',
  footer,
  contentStyle,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, scale]);

  const initials =
    avatarLabel ??
    title
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topLogo}>
          <Text style={styles.topLogoText}>B</Text>
        </View>
        <Text style={styles.topBrand}>BlinkOne</Text>
      </View>

      <View style={[styles.body, contentStyle]}>
        <View style={styles.avatarWrap}>
          {pulse ? (
            <Animated.View style={[styles.pulseRing, { transform: [{ scale }] }]} />
          ) : null}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.statusRow}>
          {pulse && <View style={styles.statusDot} />}
          <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {children}
      </View>

      <View style={styles.footer}>
        {footer}
        {onEndCall ? (
          <>
            <TouchableOpacity onPress={onEndCall} style={styles.endBtn} activeOpacity={0.85}>
              <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.endLabel}>{endLabel}</Text>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CallTheme.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: CallTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLogoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  topBrand: {
    color: CallTheme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  avatarWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(0,115,230,0.5)',
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: CallTheme.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: CallTheme.accent,
  },
  avatarText: {
    color: CallTheme.text,
    fontSize: 40,
    fontWeight: '700',
  },
  title: {
    color: CallTheme.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: CallTheme.textMute,
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CallTheme.accent,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 32,
    gap: 12,
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: CallTheme.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CallTheme.redDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  endLabel: {
    color: CallTheme.textMute,
    fontSize: 13,
    fontWeight: '600',
  },
});
