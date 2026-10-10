import { Platform } from 'react-native';

import { getNotifications } from './module';
import { ANDROID_CHANNEL } from './permissions';

export const WEEKLY_RECAP_ID = 'recap-weekly';
export const MONTHLY_RECAP_ID = 'recap-monthly';

export interface ReminderPayload extends Record<string, unknown> {
  /** expo-router path to open when tapped. */
  url: string;
  kind: 'recap' | 'planned';
  id?: string;
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
}

async function cancel(identifier: string) {
  const N = getNotifications();
  if (!N) return;
  await N.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
}

/** F4.6: every Monday at the chosen time. */
export async function scheduleWeeklyRecap(time = '09:00') {
  const N = getNotifications();
  if (!N) return;
  await cancel(WEEKLY_RECAP_ID);
  const { hour, minute } = parseTime(time);
  const data: ReminderPayload = { url: '/(tabs)/recaps?period=week', kind: 'recap' };
  await N.scheduleNotificationAsync({
    identifier: WEEKLY_RECAP_ID,
    content: { title: 'Your weekly recap is ready', body: 'See what you spent last week and how it compares.', data },
    trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour, minute, channelId: ANDROID_CHANNEL },
  });
}

/**
 * F4.6: the 1st of each month. iOS has a native monthly trigger; Android does
 * not, so we schedule the next occurrence as a date and re-arm on app open.
 */
export async function scheduleMonthlyRecap(time = '09:00', now = new Date()) {
  const N = getNotifications();
  if (!N) return;
  await cancel(MONTHLY_RECAP_ID);
  const { hour, minute } = parseTime(time);
  const data: ReminderPayload = { url: '/(tabs)/recaps?period=month', kind: 'recap' };
  const content = { title: 'Your monthly recap is ready', body: 'Last month in numbers, with a short summary.', data };

  if (Platform.OS === 'ios') {
    await N.scheduleNotificationAsync({
      identifier: MONTHLY_RECAP_ID,
      content,
      trigger: { type: N.SchedulableTriggerInputTypes.MONTHLY, day: 1, hour, minute },
    });
    return;
  }
  const next = new Date(now.getFullYear(), now.getMonth(), 1, hour, minute, 0, 0);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  await N.scheduleNotificationAsync({
    identifier: MONTHLY_RECAP_ID,
    content,
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: next, channelId: ANDROID_CHANNEL },
  });
}

export async function cancelWeeklyRecap() {
  await cancel(WEEKLY_RECAP_ID);
}
export async function cancelMonthlyRecap() {
  await cancel(MONTHLY_RECAP_ID);
}

/**
 * Two reminders for one planned expense (E5): the day before and at the time
 * itself, so a plan made at short notice still gets one. Past offsets are
 * skipped; a reminder in the past is pointless noise.
 */
export async function schedulePlannedReminders(input: { id: string; title: string; amountLabel: string; scheduledAt: Date; now?: Date }) {
  const N = getNotifications();
  if (!N) return;
  const now = input.now ?? new Date();
  await cancelPlannedReminders(input.id);
  const data: ReminderPayload = { url: `/planned/${input.id}`, kind: 'planned', id: input.id };
  const offsets: { suffix: string; ms: number; body: string }[] = [
    { suffix: '24h', ms: 24 * 60 * 60 * 1000, body: `Tomorrow: ${input.title} · ${input.amountLabel}` },
    { suffix: 'now', ms: 0, body: `Now: ${input.title} · ${input.amountLabel}` },
  ];
  for (const o of offsets) {
    const at = new Date(input.scheduledAt.getTime() - o.ms);
    if (at <= now) continue;
    await N.scheduleNotificationAsync({
      identifier: `planned-${input.id}-${o.suffix}`,
      content: { title: 'Planned expense', body: o.body, data },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: ANDROID_CHANNEL },
    });
  }
}

export async function cancelPlannedReminders(id: string) {
  // `1h` is no longer scheduled; cancelling it clears reminders armed by earlier builds.
  await Promise.all([cancel(`planned-${id}-24h`), cancel(`planned-${id}-now`), cancel(`planned-${id}-1h`)]);
}
