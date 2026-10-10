import Constants, { ExecutionEnvironment } from 'expo-constants';
import { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/src/lib/theme';
import { CustomSignIn } from './CustomSignIn';

/** Expo Go ships without Clerk's native module, so AuthView cannot load there. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Loaded on demand so Expo Go never evaluates the native module.
const AuthView = lazy(() => import('@clerk/expo/native').then((m) => ({ default: m.AuthView })));

/**
 * iOS / Android sign-in.
 * - Development and store builds: Clerk's native AuthView (sign-in or sign-up,
 *   every method enabled in the Clerk dashboard, MFA and bot checks included).
 * - Expo Go: our CustomSignIn fallback built on Clerk's legacy hooks.
 * The web build resolves ClerkAuthScreen.web.tsx instead of this file.
 */
export function ClerkAuthScreen() {
  const theme = useThemeColors();
  if (isExpoGo) return <CustomSignIn />;
  return (
    <SafeAreaView className="bg-card flex-1" edges={['top', 'bottom']}>
      <Suspense
        fallback={
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme.primary} />
          </View>
        }
      >
        <AuthView mode="signInOrUp" isDismissible={false} />
      </Suspense>
    </SafeAreaView>
  );
}
