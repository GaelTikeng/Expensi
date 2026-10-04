import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  // Fail loudly in development; a missing key otherwise surfaces as a
  // confusing "not signed in" state deep inside the app.
  throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy .env.example to .env.');
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}
