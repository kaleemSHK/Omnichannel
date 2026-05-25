import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function CustomerLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1a1d26', borderTopColor: 'rgba(255,255,255,0.08)' },
        tabBarActiveTintColor: '#63b3ed',
        tabBarInactiveTintColor: '#5a6170',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
      <Tabs.Screen name="tickets/index" options={{ title: t('customer.my_tickets'), tabBarIcon: () => null }} />
      <Tabs.Screen name="tickets/[id]" options={{ href: null }} />
    </Tabs>
  );
}
