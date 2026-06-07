import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/lib/ui';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
};

/** Five9-style navy header strip for home / dashboard screens */
export function Five9Header({ title, subtitle, right, style }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 12 }, style]}>
      <View style={s.row}>
        <View style={s.brandMark}>
          <Text style={s.brandLetter}>B</Text>
        </View>
        <View style={s.titles}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  titles: { flex: 1 },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginTop: 2,
  },
});
