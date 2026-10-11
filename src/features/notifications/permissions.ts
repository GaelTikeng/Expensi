import { Alert, Linking, Platform } from 'react-native';

import { getNotifications } from './module';
import { t } from '@/src/i18n';

export const ANDROID_CHANNEL = 'reminders';

/** Idempotent; Android needs a channel before anything can be shown. */
export async function ensureChannel() {
  const N = getNotifications();
  if (!N || Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: t('notifications.channelName'),
    importance: N.AndroidImportance.HIGH,
    description: t('notifications.channelDescription'),
  });
}

function explain(reason: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t('notifications.allowTitle'), reason, [
      { text: t('common.notNow'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('common.continue'), onPress: () => resolve(true) },
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
    Alert.alert(t('notifications.offTitle'), t('notifications.offMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.openSettings'), onPress: () => void Linking.openSettings() },
    ]);
    return false;
  }

  if (!(await explain(reason))) return false;
  const res = await N.requestPermissionsAsync();
  return res.granted;
}
