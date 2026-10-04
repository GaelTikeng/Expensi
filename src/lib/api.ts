import Constants from 'expo-constants';

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
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${body}`);
  }
  return (await res.json()) as T;
}
