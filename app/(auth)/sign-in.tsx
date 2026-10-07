import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useEmailCodeAuth } from '@/src/features/auth/useEmailCodeAuth';
import { useGoogleAuth } from '@/src/features/auth/useGoogleAuth';
import { useWarmUpBrowser } from '@/src/features/auth/useWarmUpBrowser';

/**
 * Combined sign-in-or-up (F1.2). One email field; Clerk decides whether the
 * address is known. New users are created transparently on first code entry.
 * Google is a one-tap alternative.
 */
export default function SignInScreen() {
  useWarmUpBrowser();
  const email = useEmailCodeAuth();
  const google = useGoogleAuth();

  const [emailText, setEmailText] = useState('');
  const [codeText, setCodeText] = useState('');

  const busy = email.busy || google.busy;
  const error = email.error ?? google.error;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>xpens-ia</Text>
        <Text style={styles.subtitle}>
          {email.step === 'email'
            ? 'Sign in or create an account with your email.'
            : `We sent a 6-digit code to ${email.emailAddress}.`}
        </Text>

        {email.step === 'email' ? (
          <>
            <TextInput
              style={styles.input}
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
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              disabled={busy || !emailText.includes('@')}
              onPress={() => email.sendCode(emailText)}
            >
              {email.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue with email</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              style={[styles.button, styles.buttonSecondary, busy && styles.buttonDisabled]}
              disabled={busy}
              onPress={google.start}
            >
              {google.busy ? <ActivityIndicator /> : <Text style={styles.buttonSecondaryText}>Continue with Google</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.codeInput]}
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
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              disabled={busy || codeText.length < 6}
              onPress={() => email.verifyCode(codeText)}
            >
              {email.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
            </Pressable>
            <Pressable style={styles.link} disabled={busy} onPress={() => { setCodeText(''); email.reset(); }}>
              <Text style={styles.linkText}>Use a different email</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F6F7F9' },
  card: { gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 22 },
  button: {
    backgroundColor: '#1F5EFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D7DAE0' },
  buttonSecondaryText: { color: '#111', fontWeight: '600', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { flex: 1, height: 1, backgroundColor: '#E3E6EB' },
  dividerText: { color: '#888', fontSize: 12 },
  link: { alignItems: 'center', paddingVertical: 6 },
  linkText: { color: '#1F5EFF', fontSize: 14 },
  error: { color: '#C0392B', fontSize: 13, marginTop: 4 },
});
