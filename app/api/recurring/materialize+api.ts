import { json, withAuth } from '@/src/server/auth/clerk';
import { plannedToDto } from '@/src/server/services/planned/dto';
import { isoDateInZone, nextPeriodStart, startOfMonth } from '@/src/lib/dates';

/**
 * F6.3: ensures this month's and next month's planned rows exist for every
 * active charge. Called by the app on open; idempotent. Returns only rows
 * created by this call so the client can schedule their reminders.
 */
export const POST = withAuth(async (_req, { user, repos }) => {
  const thisMonth = startOfMonth(isoDateInZone(new Date(), user.timezone));
  const nextMonth = nextPeriodStart('month', thisMonth);
  const created = [...(await repos.recurring.materialize(user, thisMonth)), ...(await repos.recurring.materialize(user, nextMonth))];
  return json({ created: created.map(plannedToDto) });
});
