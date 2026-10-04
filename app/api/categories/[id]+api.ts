import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { categoryPatchSchema } from '@/src/lib/schemas/category';
import { isUuid } from '@/src/lib/uuid';

export const PATCH = withAuth(async (req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const parsed = categoryPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return json({ error: 'empty_patch' }, { status: 400 });
  return json(await repos.categories.update(id, parsed.data));
});

export const DELETE = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const ok = await repos.categories.softDelete(id);
  return ok ? json({ ok: true }) : json({ error: 'not_found' }, { status: 404 });
});
