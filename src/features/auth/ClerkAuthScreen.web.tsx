import { SignIn } from '@clerk/expo/web';
import { ScrollView, View } from 'react-native';

/**
 * Web: Clerk's prebuilt sign-in, with sign-up in the same flow. Hash routing
 * keeps Clerk's internal steps (#/factor-one, …) out of expo-router's paths.
 * The root layout's route guards take over once the session is active.
 */
export function ClerkAuthScreen() {
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="flex-grow items-center justify-center p-4">
      <View className="items-center">
        <SignIn routing="hash" withSignUp fallbackRedirectUrl="/" />
      </View>
    </ScrollView>
  );
}
