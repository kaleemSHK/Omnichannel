import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { C } from '@/lib/ui';

type Props = {
  title: string;
  subtitle: string;
  icon: string;
  iconColor?: string;
  iconBg?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'compact';
  style?: ViewStyle;
};

export function ActionTile({
  title,
  subtitle,
  icon,
  iconColor = C.brand,
  iconBg = C.bgBlue,
  onPress,
  disabled,
  variant = 'default',
  style,
}: Props) {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
      style={[
        s.tile,
        isPrimary && s.tilePrimary,
        variant === 'compact' && s.tileCompact,
        disabled && s.disabled,
        style,
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: isPrimary ? 'rgba(255,255,255,0.2)' : iconBg }]}>
        <Ionicons
          name={icon}
          size={isPrimary ? 32 : 26}
          color={isPrimary ? '#fff' : iconColor}
        />
      </View>
      <View style={s.textWrap}>
        <Text style={[s.title, isPrimary && s.titlePrimary]}>{title}</Text>
        <Text style={[s.sub, isPrimary && s.subPrimary]}>{subtitle}</Text>
      </View>
      {!isPrimary && <Ionicons name="chevron-forward" size={20} color={C.textMute} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: C.r.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    gap: 14,
    ...C.shadow,
  },
  tilePrimary: {
    backgroundColor: C.brand,
    borderColor: C.brandDark,
    paddingVertical: 24,
    flexDirection: 'column',
    alignItems: 'center',
  },
  tileCompact: {
    padding: 14,
  },
  disabled: { opacity: 0.65 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 3,
  },
  titlePrimary: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  sub: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 18,
  },
  subPrimary: {
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
  },
});
