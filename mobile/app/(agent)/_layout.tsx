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

export default function AgentLayout() {
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
          title: t('agent.dashboard'),
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="conversations/index"
        options={{
          title: t('agent.conversations'),
          tabBarIcon: tabIcon('chatbubbles-outline', 'chatbubbles'),
        }}
      />
      <Tabs.Screen
        name="calls/index"
        options={{
          title: t('agent.calls'),
          tabBarIcon: tabIcon('call-outline', 'call'),
        }}
      />
      <Tabs.Screen
        name="dial"
        options={{
          title: t('agent.dialpad'),
          tabBarIcon: tabIcon('keypad-outline', 'keypad'),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: t('agent.contacts'),
          tabBarIcon: tabIcon('people-outline', 'people'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('agent.settings'),
          tabBarIcon: tabIcon('settings-outline', 'settings'),
        }}
      />
      {/* Hidden screens — accessible via router.push, not as tabs */}
      <Tabs.Screen name="conversations/[id]" options={{ href: null }} />
    </Tabs>
  );
}
