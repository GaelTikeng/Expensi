import { useCallback, useEffect, useState } from 'react';

import { getPrefs, setPrefs, type DevicePrefs } from '@/src/lib/prefs';
import { notificationsSupported, notificationsUnavailableReason } from './module';
import { ensureNotificationPermission } from './permissions';
import { cancelMonthlyRecap, cancelWeeklyRecap, scheduleMonthlyRecap, scheduleWeeklyRecap } from './schedule';
import { t } from '@/src/i18n';

/** Settings toggles for F4.6. Opt-in; asks permission with a rationale first. */
export function useRecapReminders() {
  const [prefs, setLocal] = useState<DevicePrefs | null>(null);

  useEffect(() => {
    void getPrefs().then(setLocal);
  }, []);

  const setWeekly = useCallback(async (on: boolean) => {
    if (on && !(await ensureNotificationPermission(t('notifications.weeklyPermission')))) return;
    const next = await setPrefs({ weeklyRecapReminder: on });
    setLocal(next);
    if (on) await scheduleWeeklyRecap(next.recapReminderTime);
    else await cancelWeeklyRecap();
  }, []);

  const setMonthly = useCallback(async (on: boolean) => {
    if (on && !(await ensureNotificationPermission(t('notifications.monthlyPermission')))) return;
    const next = await setPrefs({ monthlyRecapReminder: on });
    setLocal(next);
    if (on) await scheduleMonthlyRecap(next.recapReminderTime);
    else await cancelMonthlyRecap();
  }, []);

  return { prefs, setWeekly, setMonthly, supported: notificationsSupported, unavailableReason: notificationsUnavailableReason };
}
