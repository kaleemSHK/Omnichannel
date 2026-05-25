import { useEffect } from 'react';
import { router } from 'expo-router';
import { loadPrefs } from '@/lib/storage';
import { useAuthStore } from '@/store/auth';
import { View, ActivityIndicator } from 'react-native';

export default function EntryPoint() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const tokens = useAuthStore((s) => s.tokens);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const prefs = await loadPrefs();
      if (prefs.role === 'customer') {
        router.replace('/(customer)');
      } else if (tokens?.accessToken) {
        router.replace('/(agent)');
      } else {
        router.replace('/auth/select-role');
      }
    })();
  }, [hydrated, tokens?.accessToken]);

  return (
    <View className="flex-1 bg-bg items-center justify-center">
      <ActivityIndicator color="#63b3ed" />
    </View>
  );
}
