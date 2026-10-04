import { cancelPlannedReminders, schedulePlannedReminders } from '@/src/features/notifications/schedule';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { PlannedDto } from '@/src/lib/schemas/planned';

/**
 * iOS allows 64 pending local notifications per app. Two per plan plus the
 * two recap reminders leaves room for ~30 upcoming plans; the rest get their
 * reminders when they move into the window on a later sync.
 */
const MAX_PLANS_WITH_REMINDERS = 30;

export async function scheduleFor(p: PlannedDto, currency: CurrencyInfo) {
  if (p.status !== 'planned') return cancelPlannedReminders(p.id);
  await schedulePlannedReminders({
    id: p.id,
    title: p.title,
    amountLabel: formatMoney(p.amountMinor, currency),
    scheduledAt: new Date(p.scheduledAt),
  });
}

export const cancelFor = (id: string) => cancelPlannedReminders(id);

/** F5.3: makes this device's pending reminders match the server's upcoming plans. */
export async function syncReminders(upcoming: PlannedDto[], lookup: (code: string) => CurrencyInfo) {
  const now = Date.now();
  const future = upcoming
    .filter((p) => p.status === 'planned' && new Date(p.scheduledAt).getTime() > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, MAX_PLANS_WITH_REMINDERS);
  for (const p of future) await scheduleFor(p, lookup(p.currency));
}
