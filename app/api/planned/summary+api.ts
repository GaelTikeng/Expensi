import { json, queryObject, withAuth } from '@/src/server/auth/clerk';

/** F5.7: `GET /api/planned/summary?year=2026` → 12 months of planned / done / skipped totals. */
export const GET = withAuth(async (req, { user, repos }) => {
  const year = Number(queryObject(req).year) || new Date().getFullYear();
  if (year < 2000 || year > 2100) return json({ error: 'invalid_year' }, { status: 400 });
  return json({ year, months: await repos.planned.summaryByMonth(year, user.defaultCurrency) });
});
