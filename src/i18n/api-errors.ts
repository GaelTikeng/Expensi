import { i18n, t } from './index';

/**
 * E14: the server answers errors as `{ error: code }`. The user sees that code
 * in their language; codes without a message fall back to a generic line.
 */
export function apiErrorText(status: number, code: string | null): string {
  const key = code ? `apiErrors.${code}` : null;
  if (key && i18n.exists(key)) return t(key as 'apiErrors.generic', { status });
  if (status === 401) return t('apiErrors.unauthenticated');
  return t('apiErrors.generic', { status });
}
