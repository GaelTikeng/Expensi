import * as Sentry from '@sentry/react-native';

/**
 * F7.5: client error reporting, on only when a DSN is configured. Call once
 * at the top of the root layout module. No PII is attached beyond what
 * Sentry collects by default; user ids are set after sign-in.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    environment: process.env.EXPO_PUBLIC_API_URL ? 'production' : 'development',
  });
}

export function setSentryUser(id: string | null) {
  if (!dsn) return;
  Sentry.setUser(id ? { id } : null);
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  if (!dsn) {
    console.warn('[error]', err, context);
    return;
  }
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
