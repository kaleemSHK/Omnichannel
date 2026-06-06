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

const WA = {
  bg: '#0B141A',
  bgSoft: '#1F2C34',
  accent: '#00A884',
  text: '#E9EDEF',
  textMute: '#8696A0',
  red: '#F15C6D',
  redDark: '#E74C3C',
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
  statusColor = WA.accent,
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
        Animated.timing(scale, { toValue: 1.12, duration: 900, useNativeDriver: true }),
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
        <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>

        {children}
      </View>

      <View style={styles.footer}>
        {footer}
        {onEndCall ? (
          <TouchableOpacity onPress={onEndCall} style={styles.endBtn} activeOpacity={0.85}>
            <Text style={styles.endIcon}>📵</Text>
          </TouchableOpacity>
        ) : null}
        {onEndCall ? <Text style={styles.endLabel}>{endLabel}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

export const CallTheme = WA;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WA.bg,
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
    borderColor: 'rgba(0,168,132,0.45)',
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: WA.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: WA.accent,
  },
  avatarText: {
    color: WA.text,
    fontSize: 40,
    fontWeight: '700',
  },
  title: {
    color: WA.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: WA.textMute,
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  status: {
    fontSize: 16,
    marginTop: 16,
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
    backgroundColor: WA.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: WA.redDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  endIcon: {
    fontSize: 32,
  },
  endLabel: {
    color: WA.textMute,
    fontSize: 13,
  },
});
