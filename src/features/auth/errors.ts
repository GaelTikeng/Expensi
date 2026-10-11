import { t } from '@/src/i18n';

/**
 * Clerk error helpers. Deliberately free of `@clerk/expo` imports so this
 * module stays unit-testable in Node: the check below is the same structural
 * test Clerk's own `isClerkAPIResponseError` performs.
 */

export interface ClerkAPIErrorLike {
  code: string;
  message: string;
  longMessage?: string;
}

interface ClerkAPIResponseErrorLike {
  clerkError: true;
  errors: ClerkAPIErrorLike[];
}

export function isClerkAPIResponseError(err: unknown): err is ClerkAPIResponseErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { clerkError?: unknown }).clerkError === true &&
    Array.isArray((err as { errors?: unknown }).errors)
  );
}

/** Clerk error codes we react to specially. */
export const CLERK_CODES = {
  identifierNotFound: 'form_identifier_not_found',
  identifierExists: 'form_identifier_exists',
  codeIncorrect: 'form_code_incorrect',
  verificationExpired: 'verification_expired',
} as const;

export function clerkErrorCode(err: unknown): string | null {
  if (isClerkAPIResponseError(err)) return err.errors[0]?.code ?? null;
  return null;
}

/** Human-readable message for the sign-in screen. Never exposes raw codes. */
export function clerkErrorMessage(err: unknown): string {
  if (isClerkAPIResponseError(err)) {
    const first = err.errors[0];
    switch (first?.code) {
      case CLERK_CODES.codeIncorrect:
        return t('auth.errors.codeIncorrect');
      case CLERK_CODES.verificationExpired:
        return t('auth.errors.codeExpired');
      case 'form_param_format_invalid':
        return t('auth.errors.emailInvalid');
      case 'too_many_requests':
        return t('auth.errors.tooManyAttempts');
      default:
        return first?.longMessage ?? first?.message ?? t('auth.errors.generic');
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return t('auth.errors.generic');
}
