import { router } from 'expo-router';
import { useEffect } from 'react';

import { getPrefs } from '@/src/lib/prefs';
import { getNotifications } from './module';
import { ensureChannel } from './permissions';
import { scheduleMonthlyRecap, type ReminderPayload } from './schedule';

let handlerInstalled = false;

/** Foreground behaviour: show the banner even while the app is open. */
function installHandler(N: NonNullable<ReturnType<typeof getNotifications>>) {
  if (handlerInstalled) return;
  handlerInstalled = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function openFromPayload(data: unknown) {
  const payload = data as Partial<ReminderPayload> | undefined;
  if (payload?.url) router.push(payload.url as never);
}

/**
 * Mount once in the signed-in shell: creates the Android channel, re-arms
 * the Android monthly reminder, and routes notification taps.
 */
export function useNotificationSetup() {
  useEffect(() => {
    const N = getNotifications();
    if (!N) return; // Web or Expo Go on Android: no usable notifications module.
    installHandler(N);
    void ensureChannel();
    void getPrefs().then((p) => {
      if (p.monthlyRecapReminder) void scheduleMonthlyRecap(p.recapReminderTime);
    });

    // Cold start from a tap.
    void N.getLastNotificationResponseAsync().then((res) => {
      if (res) openFromPayload(res.notification.request.content.data);
    });
    const sub = N.addNotificationResponseReceivedListener((res) => openFromPayload(res.notification.request.content.data));
    return () => sub.remove();
  }, []);
}
