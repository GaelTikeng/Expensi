import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { useThemeColors } from '@/src/lib/theme';
import { useEmailCodeAuth } from './useEmailCodeAuth';
import { useGoogleAuth } from './useGoogleAuth';
import { useWarmUpBrowser } from './useWarmUpBrowser';

/**
 * Our own sign-in-or-up screen, built on Clerk's legacy hooks. Used only in
 * Expo Go, where Clerk's native AuthView cannot load (see ClerkAuthScreen).
 * One email field; Clerk decides whether the address is known. New users are
 * created on first code entry. Google is a one-tap alternative.
 */
export function CustomSignIn() {
  const theme = useThemeColors();
  useWarmUpBrowser();
  const email = useEmailCodeAuth();
  const google = useGoogleAuth();

  const [emailText, setEmailText] = useState('');
  const [codeText, setCodeText] = useState('');

  const busy = email.busy || google.busy;
  const error = email.error ?? google.error;

  return (
    <KeyboardAvoidingView className="bg-background flex-1 justify-center p-6" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">xpens-ia</CardTitle>
          <CardDescription>
            {email.step === 'email'
              ? 'Sign in or create an account with your email.'
              : `We sent a 6-digit code to ${email.emailAddress}.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="gap-3">
          {email.step === 'email' ? (
            <>
              <Input
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                value={emailText}
                onChangeText={setEmailText}
                editable={!busy}
                onSubmitEditing={() => email.sendCode(emailText)}
              />
              <Button disabled={busy || !emailText.includes('@')} onPress={() => email.sendCode(emailText)}>
                {email.busy ? <ActivityIndicator color={theme.primaryForeground} /> : <Text>Continue with email</Text>}
              </Button>

              <View className="flex-row items-center gap-2">
                <Separator className="flex-1" />
                <Text className="text-muted-foreground text-xs">or</Text>
                <Separator className="flex-1" />
              </View>

              <Button variant="outline" disabled={busy} onPress={google.start}>
                {google.busy ? <ActivityIndicator /> : <Text>Continue with Google</Text>}
              </Button>
            </>
          ) : (
            <>
              <Input
                className="h-14 text-center text-2xl tracking-[8px]"
                placeholder="123456"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                value={codeText}
                onChangeText={setCodeText}
                editable={!busy}
                autoFocus
                onSubmitEditing={() => email.verifyCode(codeText)}
              />
              <Button disabled={busy || codeText.length < 6} onPress={() => email.verifyCode(codeText)}>
                {email.busy ? <ActivityIndicator color={theme.primaryForeground} /> : <Text>Verify</Text>}
              </Button>
              <Button
                variant="link"
                disabled={busy}
                onPress={() => {
                  setCodeText('');
                  email.reset();
                }}
              >
                <Text>Use a different email</Text>
              </Button>
            </>
          )}

          {error ? <Text className="text-destructive text-[13px]">{error}</Text> : null}
        </CardContent>
      </Card>
    </KeyboardAvoidingView>
  );
}
