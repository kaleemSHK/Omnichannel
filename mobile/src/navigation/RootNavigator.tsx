import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { AgentNavigator } from './AgentNavigator';
import { CustomerNavigator } from './CustomerNavigator';
import BootstrapScreen from '@/screens/index';
import CallActiveScreen from '@/screens/call-active';
import NotFoundScreen from '@/screens/NotFoundScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f1117' } }}>
      <Stack.Screen name="Bootstrap" component={BootstrapScreen} />
      <Stack.Screen name="Auth" component={AuthNavigator} />
      <Stack.Screen name="Agent" component={AgentNavigator} />
      <Stack.Screen name="Customer" component={CustomerNavigator} />
      <Stack.Screen
        name="CallActive"
        component={CallActiveScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="NotFound" component={NotFoundScreen} />
    </Stack.Navigator>
  );
}
