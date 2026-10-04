/**
 * Clerk error helpers. Deliberately free of `@clerk/clerk-expo` imports so this
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
        return 'That code is not right. Check the email and try again.';
      case CLERK_CODES.verificationExpired:
        return 'That code has expired. Request a new one.';
      case 'form_param_format_invalid':
        return 'That does not look like a valid email address.';
      case 'too_many_requests':
        return 'Too many attempts. Wait a minute and try again.';
      default:
        return first?.longMessage ?? first?.message ?? 'Something went wrong. Please try again.';
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
