import { View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View className="bg-warning/90 px-4 py-2 flex-row items-center justify-center">
      <Text className="text-black text-xs font-semibold">⚠️ {t('common.offline')}</Text>
    </View>
  );
}
