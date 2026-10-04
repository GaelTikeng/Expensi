import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';

import { CLERK_CODES, clerkErrorCode, clerkErrorMessage } from './errors';

type Step = 'email' | 'code';
type Mode = 'sign-in' | 'sign-up';

/**
 * Email + one-time-code flow that signs in existing users and signs up new
 * ones from the same screen. Clerk tells us which path applies when we try
 * to start a sign-in with an unknown address.
 */
export function useEmailCodeAuth() {
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();

  const [step, setStep] = useState<Step>('email');
  const [mode, setMode] = useState<Mode>('sign-in');
  const [emailAddress, setEmailAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('email');
    setMode('sign-in');
    setError(null);
  }, []);

  const sendCode = useCallback(
    async (rawEmail: string) => {
      if (!signInLoaded || !signUpLoaded || !signIn || !signUp) return;
      const email = rawEmail.trim().toLowerCase();
      setBusy(true);
      setError(null);
      try {
        try {
          // Path 1: existing account → email_code first factor.
          const attempt = await signIn.create({ identifier: email });
          const factor = attempt.supportedFirstFactors?.find(
            (f) => f.strategy === 'email_code',
          );
          if (!factor || factor.strategy !== 'email_code') {
            throw new Error('Email code sign-in is not enabled for this account.');
          }
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: factor.emailAddressId,
          });
          setMode('sign-in');
        } catch (err) {
          if (clerkErrorCode(err) !== CLERK_CODES.identifierNotFound) throw err;
          // Path 2: unknown address → create the account and verify the email.
          await signUp.create({ emailAddress: email });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setMode('sign-up');
        }
        setEmailAddress(email);
        setStep('code');
      } catch (err) {
        setError(clerkErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [signIn, signUp, signInLoaded, signUpLoaded],
  );

  const verifyCode = useCallback(
    async (code: string) => {
      if (!signIn || !signUp) return;
      setBusy(true);
      setError(null);
      try {
        if (mode === 'sign-in') {
          const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code });
          if (result.status !== 'complete' || !result.createdSessionId) {
            throw new Error('Sign-in needs another step that this app does not support yet.');
          }
          await setActiveSignIn({ session: result.createdSessionId });
        } else {
          const result = await signUp.attemptEmailAddressVerification({ code });
          if (result.status !== 'complete' || !result.createdSessionId) {
            throw new Error('Sign-up needs more information than this app collects yet.');
          }
          await setActiveSignUp({ session: result.createdSessionId });
        }
        // Route guards in app/_layout.tsx take over once the session is active.
      } catch (err) {
        setError(clerkErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [mode, signIn, signUp, setActiveSignIn, setActiveSignUp],
  );

  return { step, mode, emailAddress, busy, error, sendCode, verifyCode, reset };
}
