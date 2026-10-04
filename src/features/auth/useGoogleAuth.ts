import { useSSO } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import { useCallback, useState } from 'react';

import { clerkErrorMessage } from './errors';

/**
 * Google via Clerk SSO. The OAuth round-trip happens in a system browser and
 * returns to the app through the `expenseapp://` scheme declared in app.json.
 */
export function useGoogleAuth() {
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ path: 'sso-callback' }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        return;
      }
      // The user closed the browser, or Clerk needs a missing field (for
      // example a username requirement). We don't collect extra fields.
      if (signUp?.status === 'missing_requirements') {
        setError('Your Google account is missing information Clerk requires. Use email instead.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [startSSOFlow]);

  return { start, busy, error };
}
