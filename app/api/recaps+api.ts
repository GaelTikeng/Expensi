import { json, queryObject, withAuth } from '@/src/server/auth/clerk';
import { db } from '@/src/server/db/client';
import { getOrBuildRecap } from '@/src/server/services/recaps';
import { todayISO } from '@/src/lib/dates';
import { recapQuerySchema } from '@/src/lib/schemas/recap';
import { requestLanguage } from '@/src/i18n/languages';

/** F4.2: `GET /api/recaps?period=month&start=2026-10-01&narrative=1` */
export const GET = withAuth(async (req, { user, repos }) => {
  const parsed = recapQuerySchema.safeParse(queryObject(req));
  if (!parsed.success) return json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  const { period, start, narrative } = parsed.data;
  const language = requestLanguage(user.language, req.headers.get('accept-language'));
  const recap = await getOrBuildRecap(db, repos, user, period, start ?? todayISO(), narrative === '1', language);
  return json({ recap });
});
