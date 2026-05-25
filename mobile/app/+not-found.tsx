import { View, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFound() {
  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
      <Stack.Screen options={{ title: 'Not Found' }} />
      <Text className="text-text-primary text-xl font-bold mb-4">Page not found</Text>
      <Link href="/">
        <Text className="text-brand">Go home</Text>
      </Link>
    </SafeAreaView>
  );
}
