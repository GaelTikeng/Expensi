import Constants from 'expo-constants';
import { currentLanguage, t } from '@/src/i18n';
import { apiErrorText } from '@/src/i18n/api-errors';

/**
 * Base URL for the Expo API Routes. In development, Metro serves them from the
 * same origin as the bundle; in production EXPO_PUBLIC_API_URL points at the
 * EAS Hosting deployment.
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri;
  if (host) return `http://${host}`;
  return '';
}

/**
 * Minimal authenticated fetch. `getToken` is Clerk's `useAuth().getToken`.
 * Feature modules wrap this with typed request/response helpers.
 */
export async function apiFetch<T>(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'accept-language': currentLanguage(),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiError(0, 'network', t('apiErrors.network'), err);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const code = errorCode(body);
    if (__DEV__) console.warn(`[api] ${res.status} ${path}: ${body}`);
    throw new ApiError(res.status, code, apiErrorText(res.status, code));
  }
  return (await res.json()) as T;
}

/**
 * E14: the server answers `{ error: code }`; the message the user sees is that
 * code in their language. The raw body goes to the dev console only.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ApiError';
  }
}

function errorCode(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    const code = parsed && typeof parsed === 'object' ? (parsed as { error?: unknown }).error : null;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

