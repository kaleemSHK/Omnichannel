import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { loadPrefs, loadCustomerSession } from '@/lib/storage';
import { useAuthStore } from '@/store/auth';
import type { RootStackParamList } from '@/navigation/types';

export default function BootstrapScreen() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const tokens = useAuthStore((s) => s.tokens);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const prefs = await loadPrefs();
      if (prefs.role === 'customer') {
        const session = await loadCustomerSession();
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'Customer',
              state: {
                routes: [{ name: session.token ? 'CustomerTabs' : 'CustomerWelcome' }],
              },
            },
          ],
        });
      } else if (tokens?.accessToken) {
        navigation.reset({ index: 0, routes: [{ name: 'Agent' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
      }
    })();
  }, [hydrated, tokens?.accessToken, navigation]);

  return (
    <View className="flex-1 bg-bg items-center justify-center">
      <ActivityIndicator color="#63b3ed" />
    </View>
  );
}
