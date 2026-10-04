import { json, withAuth } from '@/src/server/auth/clerk';
import { db } from '@/src/server/db/client';
import { buildDetail } from '@/src/server/services/imports/dto';
import { processImport } from '@/src/server/services/imports/process';
import { isUuid } from '@/src/lib/uuid';

/**
 * Runs the parse → AI → stage pipeline synchronously and returns the detail.
 * Safe to call again: a finished import is returned as-is, an in-flight one
 * answers 409, and a failed one is retried up to the attempt cap.
 */
export const POST = withAuth(async (_req, { user, repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const imp = await repos.imports.findById(id);
  if (!imp) return json({ error: 'not_found' }, { status: 404 });
  const result = await processImport(repos, user, imp);
  const items = await repos.imports.listItems(id);
  return json(await buildDetail(db, user.id, result, items));
});
