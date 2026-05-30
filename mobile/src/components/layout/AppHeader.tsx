import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C } from '@/lib/ui';

interface AppHeaderProps { title: string; right?: React.ReactNode; onBack?: () => void; }

export function AppHeader({ title, right, onBack }: AppHeaderProps) {
  const navigation = useNavigation();
  return (
    <View style={s.bar}>
      <TouchableOpacity onPress={onBack ?? (() => navigation.goBack())} style={s.back}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  bar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCard },
  back:    { marginRight: 12, paddingVertical: 2 },
  backTxt: { color: C.brand, fontSize: 15, fontWeight: '500' },
  title:   { flex: 1, color: C.text, fontSize: 17, fontWeight: '700' },
});
