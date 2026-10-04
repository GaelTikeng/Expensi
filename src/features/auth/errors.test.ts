import { describe, expect, it } from 'vitest';

import { clerkErrorCode, clerkErrorMessage } from './errors';

/** Shape Clerk throws for API errors; mirrors ClerkAPIResponseError. */
function clerkError(code: string, message = 'msg', longMessage?: string) {
  return {
    clerkError: true,
    status: 422,
    errors: [{ code, message, longMessage }],
  };
}

describe('clerkErrorCode', () => {
  it('reads the first Clerk error code', () => {
    expect(clerkErrorCode(clerkError('form_identifier_not_found'))).toBe('form_identifier_not_found');
  });
  it('returns null for non-Clerk errors', () => {
    expect(clerkErrorCode(new Error('boom'))).toBeNull();
    expect(clerkErrorCode(undefined)).toBeNull();
  });
});

describe('clerkErrorMessage', () => {
  it('maps known codes to friendly text', () => {
    expect(clerkErrorMessage(clerkError('form_code_incorrect'))).toMatch(/not right/);
    expect(clerkErrorMessage(clerkError('verification_expired'))).toMatch(/expired/);
    expect(clerkErrorMessage(clerkError('too_many_requests'))).toMatch(/Too many/);
  });
  it('prefers longMessage, then message, for unknown codes', () => {
    expect(clerkErrorMessage(clerkError('x', 'short', 'long explanation'))).toBe('long explanation');
    expect(clerkErrorMessage(clerkError('x', 'short'))).toBe('short');
  });
  it('uses Error.message for plain errors and a fallback otherwise', () => {
    expect(clerkErrorMessage(new Error('network down'))).toBe('network down');
    expect(clerkErrorMessage(42)).toMatch(/Something went wrong/);
  });
});
