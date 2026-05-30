import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { AgentStackParamList, AgentTabParamList } from './types';
import { AgentCallOverlay } from '@/components/calling/AgentCallOverlay';
import AgentDashboard from '@/screens/(agent)/index';
import AgentConversations from '@/screens/(agent)/conversations/index';
import AgentCalls from '@/screens/(agent)/calls/index';
import AgentDial from '@/screens/(agent)/dial';
import AgentContacts from '@/screens/(agent)/contacts';
import AgentSettings from '@/screens/(agent)/settings';
import ConversationDetail from '@/screens/(agent)/conversations/[id]';

const Tab = createBottomTabNavigator<AgentTabParamList>();
const Stack = createNativeStackNavigator<AgentStackParamList>();

function AgentTabs() {
  const { t } = useTranslation();

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#1a1d26', borderTopColor: 'rgba(255,255,255,0.08)' },
          tabBarActiveTintColor: '#63b3ed',
          tabBarInactiveTintColor: '#5a6170',
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={AgentDashboard}
          options={{
            title: t('agent.dashboard'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Conversations"
          component={AgentConversations}
          options={{
            title: t('agent.conversations'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Calls"
          component={AgentCalls}
          options={{
            title: t('agent.calls'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'call' : 'call-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Dial"
          component={AgentDial}
          options={{
            title: t('agent.dialpad'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'keypad' : 'keypad-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Contacts"
          component={AgentContacts}
          options={{
            title: t('agent.contacts'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={AgentSettings}
          options={{
            title: t('agent.settings'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <AgentCallOverlay />
    </>
  );
}

export function AgentNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f1117' } }}>
      <Stack.Screen name="AgentTabs" component={AgentTabs} />
      <Stack.Screen name="ConversationDetail" component={ConversationDetail} />
    </Stack.Navigator>
  );
}
