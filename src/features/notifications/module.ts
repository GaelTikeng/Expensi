import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Where local notifications cannot be used, and why:
 * - Expo Go on Android: since SDK 53 it ships without expo-notifications and
 *   the module throws as soon as it is imported.
 * - Web: the module loads, but scheduling, permissions and response listeners
 *   are not implemented and throw when called.
 * Everywhere else (iOS Expo Go, development and store builds) it works.
 */
export type NotificationsUnavailableReason = 'web' | 'expo-go-android';

export const notificationsUnavailableReason: NotificationsUnavailableReason | null =
  Platform.OS === 'web'
    ? 'web'
    : Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? 'expo-go-android'
      : null;

export const notificationsSupported = notificationsUnavailableReason === null;

let cached: NotificationsModule | null | undefined;

/**
 * The only way code in this app should reach expo-notifications. Returns null
 * where the module is unavailable; callers then skip quietly. The module is
 * required on first use, never at import time, so unsupported environments
 * never evaluate it.
 */
export function getNotifications(): NotificationsModule | null {
  if (!notificationsSupported) return null;
  if (cached === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  }
  return cached;
}
