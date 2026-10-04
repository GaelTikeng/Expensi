import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

export const ANDROID_CHANNEL = 'reminders';

/** Idempotent; Android needs a channel before anything can be shown. */
export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
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
 */
export async function ensureNotificationPermission(reason: string): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  if (!current.canAskAgain) {
    Alert.alert('Notifications are off', 'Turn them on in Settings to get reminders.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]);
    return false;
  }

  if (!(await explain(reason))) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}
