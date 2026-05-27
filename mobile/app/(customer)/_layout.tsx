import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconName, activeName: IoniconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? activeName : name} size={22} color={color as string} />
  );
}

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
      <Tabs.Screen
        name="index"
        options={{
          title: t('customer.home'),
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="tickets/index"
        options={{
          title: t('customer.my_tickets'),
          tabBarIcon: tabIcon('document-text-outline', 'document-text'),
        }}
      />
      {/* Hidden screens — accessible via router.push, not as tabs */}
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
      <Tabs.Screen name="tickets/[id]" options={{ href: null }} />
    </Tabs>
  );
}
