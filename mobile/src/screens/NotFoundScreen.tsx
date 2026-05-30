import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';

export default function NotFoundScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
      <Text className="text-text-primary text-xl font-bold mb-4">Page not found</Text>
      <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Bootstrap' }] })}>
        <Text className="text-brand">Go home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
