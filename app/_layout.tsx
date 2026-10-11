import '../global.css';
// Initialises i18next before any screen renders (E14).
import '@/src/i18n';

import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { useTranslation } from 'react-i18next';

import { ActionSheetHost } from '@/src/components/action-sheet';
import { loadLanguage } from '@/src/i18n/language';
import { loadAppearance } from '@/src/lib/appearance';
import { queryClient } from '@/src/lib/query';
import { initSentry, setSentryUser } from '@/src/lib/sentry';
import { NAV_THEME, useThemeColors } from '@/src/lib/theme';

initSentry();

// Expo Router's forked NavigationContainer sets state when the initial-link
// promise resolves before its first commit on Android (expo/expo#49378,
// expo/expo#50282; still present in expo-router 57.0.25). The update is a
// no-op and the warning exists only in development builds, so keep it out of
// the red box until the upstream fix lands.
if (__DEV__ && Platform.OS === 'android') {
  LogBox.ignoreLogs([/Can't perform a React state update on a component that hasn't mounted yet/]);
}

// react-native-gesture-handler 2.32 (pinned by Expo SDK 57) reads and writes
// shared values during render inside ReanimatedSwipeable (ExpenseRow), which
// Reanimated 4's strict mode reports on every row. Our own code reads shared
// values only inside worklets. Re-enable strict mode once a gesture-handler
// release fixes ReanimatedSwipeable.
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });


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
  const { t } = useTranslation();

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
        <Stack.Screen name="expense/new" options={{ title: t('screens.newExpense'), presentation: 'modal' }} />
        <Stack.Screen name="expense/[id]" options={{ title: t('screens.expense') }} />
        <Stack.Screen name="import/index" options={{ title: t('screens.imports') }} />
        <Stack.Screen name="import/[id]" options={{ title: t('screens.reviewImport') }} />
        <Stack.Screen name="planned/new" options={{ title: t('screens.planExpense'), presentation: 'modal' }} />
        <Stack.Screen name="planned/[id]" options={{ title: t('screens.plannedExpense') }} />
        <Stack.Screen name="planned/month" options={{ title: t('screens.month') }} />
        <Stack.Screen name="recurring/new" options={{ title: t('screens.newFixedCharge'), presentation: 'modal' }} />
        <Stack.Screen name="recurring/[id]" options={{ title: t('screens.fixedCharge') }} />
        <Stack.Screen name="account/index" options={{ title: t('screens.account') }} />
        <Stack.Screen name="account/profile" options={{ title: t('screens.personalInfo') }} />
        <Stack.Screen name="account/currency" options={{ title: t('screens.currency') }} />
        <Stack.Screen name="account/timezone" options={{ title: t('screens.timezone') }} />
        <Stack.Screen name="account/appearance" options={{ title: t('screens.appearance') }} />
        <Stack.Screen name="account/language" options={{ title: t('screens.language') }} />
        <Stack.Screen name="account/reminders" options={{ title: t('screens.reminders') }} />
        <Stack.Screen name="account/usage" options={{ title: t('screens.aiUsage') }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="export" options={{ title: t('screens.exportExpenses') }} />
        <Stack.Screen name="privacy" options={{ title: t('screens.privacy') }} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { colorScheme: scheme } = useColorScheme();

  // E17: stored appearance (system / light / dark); see src/lib/appearance.ts.
  useEffect(() => {
    void loadAppearance();
    // E14: this device's language choice, until the account's copy arrives (tabs layout).
    void loadLanguage();
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
