import '../global.css';

import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme, useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { ActionSheetHost } from '@/src/components/action-sheet';
import { queryClient } from '@/src/lib/query';
import { initSentry, setSentryUser } from '@/src/lib/sentry';
import { NAV_THEME, useThemeColors } from '@/src/lib/theme';

initSentry();

// react-native-gesture-handler 2.32 (pinned by Expo SDK 57) reads and writes
// shared values during render inside ReanimatedSwipeable (ExpenseRow), which
// Reanimated 4's strict mode reports on every row. Our own code reads shared
// values only inside worklets. Re-enable strict mode once a gesture-handler
// release fixes ReanimatedSwipeable.
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

// F9.5: the app follows the device setting. Native defaults to "system"
// already. Web uses class-based dark mode, and NativeWind's
// colorScheme.set('system') only removes the `dark` class, so RootLayout
// mirrors the media query onto <html class="dark"> itself (in an effect: the
// call throws during server rendering).

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
  const theme = useThemeColors();

  useEffect(() => {
    setSentryUser(userId ?? null);
    // Signing out must not leave the previous user's data in the cache.
    if (isLoaded && !isSignedIn) queryClient.clear();
  }, [userId, isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.primary} />
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
  const { colorScheme: scheme } = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => colorScheme.set(query.matches ? 'dark' : 'light');
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return (
    // Required by react-native-gesture-handler (swipe-to-delete rows). Inline
    // style because GestureHandlerRootView is not registered with NativeWind.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <QueryClientProvider client={queryClient}>
          <ActionSheetHost>
            <ThemeProvider value={scheme === 'dark' ? NAV_THEME.dark : NAV_THEME.light}>
              <RootNavigator />
              <StatusBar style="auto" />
              {/* Dialogs, selects and menus from src/components/ui render here. */}
              <PortalHost />
            </ThemeProvider>
          </ActionSheetHost>
        </QueryClientProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
