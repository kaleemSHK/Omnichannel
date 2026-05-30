import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/lib/ui';
import type { RootStackParamList } from '@/navigation/types';

export default function NotFoundScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>Page not found</Text>
      <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Bootstrap' }] })}>
        <Text style={{ color: C.brand, fontSize: 15 }}>Go home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
