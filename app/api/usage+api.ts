import { json, withAuth } from '@/src/server/auth/clerk';
import { quotaStatus } from '@/src/server/ai/quota';

/** F7.6: what the user has left this month, for Settings. */
export const GET = withAuth(async (_req, { user }) => {
  const [extract, narrative] = await Promise.all([quotaStatus(user.id, 'extract'), quotaStatus(user.id, 'narrative')]);
  return json({ extract, narrative });
});
