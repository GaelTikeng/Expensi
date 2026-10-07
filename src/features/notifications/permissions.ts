import { Alert, Linking, Platform } from 'react-native';

import { getNotifications } from './module';

export const ANDROID_CHANNEL = 'reminders';

/** Idempotent; Android needs a channel before anything can be shown. */
export async function ensureChannel() {
  const N = getNotifications();
  if (!N || Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Reminders',
    importance: N.AndroidImportance.HIGH,
    description: 'Planned expenses and spending recaps',
  });
}

function explain(reason: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Allow notifications?', reason, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * F5.4: rationale first, then the system prompt. If the user previously
 * denied, point them to Settings instead of a prompt that cannot appear.
 *
 * Returns false where notifications are unavailable (Expo Go on Android), so
 * callers skip scheduling without an error.
 */
export async function ensureNotificationPermission(reason: string): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  await ensureChannel();
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;

  if (!current.canAskAgain) {
    Alert.alert('Notifications are off', 'Turn them on in Settings to get reminders.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]);
    return false;
  }

  if (!(await explain(reason))) return false;
  const res = await N.requestPermissionsAsync();
  return res.granted;
}
