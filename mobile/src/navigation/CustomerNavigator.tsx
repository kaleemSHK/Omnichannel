import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { C, tabBarScreenOptions } from '@/lib/ui';
import type { CustomerStackParamList, CustomerTabParamList } from './types';
import CustomerHome from '@/screens/(customer)/index';
import CustomerChats from '@/screens/(customer)/chat/index';
import CustomerTickets from '@/screens/(customer)/tickets/index';
import ChatDetail from '@/screens/(customer)/chat/[id]';
import TicketDetail from '@/screens/(customer)/tickets/[id]';
import NewTicket from '@/screens/(customer)/tickets/new';
import CustomerCallQueue from '@/screens/(customer)/queue';
import CustomerWelcome from '@/screens/(customer)/welcome';

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<CustomerStackParamList>();

function CustomerTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="Home"
        component={CustomerHome}
        options={{
          title: t('customer.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chats"
        component={CustomerChats}
        options={{
          title: t('customer.my_chats'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tickets"
        component={CustomerTickets}
        options={{
          title: t('customer.my_tickets'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function CustomerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="CustomerWelcome" component={CustomerWelcome} />
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
      <Stack.Screen name="ChatDetail" component={ChatDetail} />
      <Stack.Screen name="TicketDetail" component={TicketDetail} />
      <Stack.Screen name="NewTicket" component={NewTicket} />
      <Stack.Screen name="CallQueue" component={CustomerCallQueue} />
    </Stack.Navigator>
  );
}
