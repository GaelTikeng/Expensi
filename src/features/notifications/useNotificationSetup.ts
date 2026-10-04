import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { getPrefs } from '@/src/lib/prefs';
import { ensureChannel } from './permissions';
import { scheduleMonthlyRecap, type ReminderPayload } from './schedule';

// Foreground behaviour: show the banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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
    void ensureChannel();
    void getPrefs().then((p) => {
      if (p.monthlyRecapReminder) void scheduleMonthlyRecap(p.recapReminderTime);
    });

    // Cold start from a tap.
    void Notifications.getLastNotificationResponseAsync().then((res) => {
      if (res) openFromPayload(res.notification.request.content.data);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((res) => openFromPayload(res.notification.request.content.data));
    return () => sub.remove();
  }, []);
}
