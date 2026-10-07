import { ClerkAuthScreen } from '@/src/features/auth/ClerkAuthScreen';

/**
 * F1.2 sign-in-or-up. The platform decides the UI:
 * web → Clerk's <SignIn />, dev/store builds → Clerk's native AuthView,
 * Expo Go → our CustomSignIn fallback. See src/features/auth/ClerkAuthScreen*.
 */
export default function SignInScreen() {
  return <ClerkAuthScreen />;
}
