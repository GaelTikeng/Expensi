import { useCallback, useEffect, useState } from 'react';

import { getPrefs, setPrefs, type DevicePrefs } from '@/src/lib/prefs';
import { ensureNotificationPermission } from './permissions';
import { cancelMonthlyRecap, cancelWeeklyRecap, scheduleMonthlyRecap, scheduleWeeklyRecap } from './schedule';

/** Settings toggles for F4.6. Opt-in; asks permission with a rationale first. */
export function useRecapReminders() {
  const [prefs, setLocal] = useState<DevicePrefs | null>(null);

  useEffect(() => {
    void getPrefs().then(setLocal);
  }, []);

  const setWeekly = useCallback(async (on: boolean) => {
    if (on && !(await ensureNotificationPermission('Get a short recap every Monday morning of what you spent last week.'))) return;
    const next = await setPrefs({ weeklyRecapReminder: on });
    setLocal(next);
    if (on) await scheduleWeeklyRecap(next.recapReminderTime);
    else await cancelWeeklyRecap();
  }, []);

  const setMonthly = useCallback(async (on: boolean) => {
    if (on && !(await ensureNotificationPermission('Get your monthly recap on the 1st, with a short written summary.'))) return;
    const next = await setPrefs({ monthlyRecapReminder: on });
    setLocal(next);
    if (on) await scheduleMonthlyRecap(next.recapReminderTime);
    else await cancelMonthlyRecap();
  }, []);

  return { prefs, setWeekly, setMonthly };
}
