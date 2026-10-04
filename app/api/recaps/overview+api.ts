import { json, withAuth } from '@/src/server/auth/clerk';
import { db } from '@/src/server/db/client';
import { getOrBuildRecap } from '@/src/server/services/recaps';
import { todayISO } from '@/src/lib/dates';
import type { RecapOverview } from '@/src/lib/schemas/recap';

/** F4.5: today / this week / this month, stats only, for the home dashboard. */
export const GET = withAuth(async (_req, { user, repos }) => {
  const today = todayISO();
  const [day, week, month] = await Promise.all([
    getOrBuildRecap(db, repos, user, 'day', today, false),
    getOrBuildRecap(db, repos, user, 'week', today, false),
    getOrBuildRecap(db, repos, user, 'month', today, false),
  ]);
  const body: RecapOverview = { today: day.stats, week: week.stats, month: month.stats };
  return json(body);
});
