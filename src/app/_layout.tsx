import 'react-native-reanimated';
import '../../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { clearAccessToken } from '@/services/sessionStorage';
import { isBackendConfigured } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);
  const authReady = useSessionStore((state) => state.authReady);
  const setAuthReady = useSessionStore((state) => state.setAuthReady);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }));

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        if (!isBackendConfigured) {
          await clearAccessToken();
          return;
        }
        const restored = await authService.restoreSession();
        if (mounted && restored) setSession(restored);
      } catch {
        await clearAccessToken();
      } finally {
        if (mounted) setAuthReady(true);
      }
    })();
    return () => { mounted = false; };
  }, [setAuthReady, setSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="register" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="otp" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
        <Stack.Protected guard={!authReady || Boolean(session)} redirectTo="/welcome">
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="(patient)" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
