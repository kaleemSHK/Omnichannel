import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C } from '@/lib/ui';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

export function SupportChatHeader({
  title = 'BlinkOne Support',
  subtitle = 'We are online · Typical reply under 5 min',
  onBack,
}: Props) {
  const navigation = useNavigation();

  return (
    <View style={s.wrap}>
      <TouchableOpacity
        onPress={onBack ?? (() => navigation.goBack())}
        style={s.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.backIcon}>‹</Text>
      </TouchableOpacity>
      <View style={s.center}>
        <View style={s.titleRow}>
          <View style={s.onlineDot} />
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={s.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={s.avatar}>
        <Text style={s.avatarText}>B1</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgCard,
    ...C.shadow,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bgMuted,
    marginRight: 10,
  },
  backIcon: { color: C.text, fontSize: 28, lineHeight: 30, marginTop: -2 },
  center: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  title: { color: C.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  subtitle: { color: C.textMute, fontSize: 12, marginTop: 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
