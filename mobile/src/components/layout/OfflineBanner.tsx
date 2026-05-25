import { View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import * as Network from 'expo-network';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    async function check() {
      const state = await Network.getNetworkStateAsync();
      setOffline(!state.isConnected);
    }
    check();
    interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!offline) return null;

  return (
    <View className="bg-warning/90 px-4 py-2 flex-row items-center justify-center">
      <Text className="text-black text-xs font-semibold">⚠️ {t('common.offline')}</Text>
    </View>
  );
}
