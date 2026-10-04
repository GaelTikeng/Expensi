import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { commitImport } from '@/src/server/services/imports/commit';
import { importCommitSchema } from '@/src/lib/schemas/import';
import { isUuid } from '@/src/lib/uuid';

/** F3.11: promote the ticked rows to expenses, atomically. */
export const POST = withAuth(async (req, { user, repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const parsed = importCommitSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const imp = await repos.imports.findById(id);
  if (!imp) return json({ error: 'not_found' }, { status: 404 });
  const result = await commitImport(repos, user.id, imp, parsed.data.acceptedItemIds);
  return json(result, { status: 201 });
});
