import './src/lib/global.css';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { SipProvider } from '@/providers/SipProvider';
import { RootNavigator } from '@/navigation/RootNavigator';
import { navigationRef } from '@/navigation/navigationRef';
import { registerForPushNotifications, addNotificationListeners } from '@/lib/notifications';
import '@/lib/i18n';
import { installWebRtcGlobals } from '@/lib/webrtc';
import { C } from '@/lib/ui';

installWebRtcGlobals();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) useAuthStore.getState().setPushToken(token);
    });

    return addNotificationListeners({});
  }, []);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <SipProvider>
              <StatusBar barStyle="dark-content" backgroundColor={C.navy} />
              <NavigationContainer ref={navigationRef}>
                <RootNavigator />
              </NavigationContainer>
            </SipProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
