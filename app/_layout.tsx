import '../global.css';

import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { initSentry, setSentryUser } from '@/src/lib/sentry';
import { NAV_THEME, THEME } from '@/src/lib/theme';

initSentry();

// Phase 1 of the NativeWind migration: most screens are still hand-styled in
// light colours, so the app stays light until phase 2 converts them. Then this
// becomes colorScheme.set('system') and NAV_THEME follows useColorScheme().
// Web needs no call (class-based dark mode defaults to light) and the call
// throws during server rendering, so it is native-only.
if (Platform.OS !== 'web') colorScheme.set('light');

const publishableKey: string = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

if (!publishableKey) {
  // Fail loudly in development; a missing key otherwise surfaces as a
  // confusing "not signed in" state deep inside the app.
  throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy .env.example to .env.');
}

/**
 * Route guards. While Clerk restores the session we show a spinner rather than
 * flashing the sign-in screen at a user who is actually signed in.
 */
function RootNavigator() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  useEffect(() => {
    setSentryUser(userId ?? null);
  }, [userId]);

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={THEME.light.primary} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="expense/new" options={{ title: 'New expense', presentation: 'modal' }} />
        <Stack.Screen name="expense/[id]" options={{ title: 'Expense' }} />
        <Stack.Screen name="import/index" options={{ title: 'Imports' }} />
        <Stack.Screen name="import/[id]" options={{ title: 'Review import' }} />
        <Stack.Screen name="planned/new" options={{ title: 'Plan an expense', presentation: 'modal' }} />
        <Stack.Screen name="planned/[id]" options={{ title: 'Planned expense' }} />
        <Stack.Screen name="planned/month" options={{ title: 'Month' }} />
        <Stack.Screen name="recurring/new" options={{ title: 'New fixed charge', presentation: 'modal' }} />
        <Stack.Screen name="recurring/[id]" options={{ title: 'Fixed charge' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider value={NAV_THEME.light}>
        <RootNavigator />
        <StatusBar style="dark" />
        {/* Dialogs, selects and menus from src/components/ui render here. */}
        <PortalHost />
      </ThemeProvider>
    </ClerkProvider>
  );
}
