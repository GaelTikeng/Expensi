import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
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
      <RootNavigator />
      <StatusBar style="auto" />
    </ClerkProvider>
  );
}
