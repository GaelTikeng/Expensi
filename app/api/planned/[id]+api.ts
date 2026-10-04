import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { plannedToDto } from '@/src/server/services/planned/dto';
import { plannedPatchSchema } from '@/src/lib/schemas/planned';
import { isUuid } from '@/src/lib/uuid';

export const GET = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const row = await repos.planned.findById(id);
  return row ? json(plannedToDto(row)) : json({ error: 'not_found' }, { status: 404 });
});

/** Edit, or set status back to `planned` / to `skipped`. */
export const PATCH = withAuth(async (req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const parsed = plannedPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return json({ error: 'empty_patch' }, { status: 400 });
  if (parsed.data.categoryId && !(await repos.categories.findById(parsed.data.categoryId))) {
    return json({ error: 'category_not_found' }, { status: 400 });
  }
  return json(plannedToDto(await repos.planned.update(id, parsed.data)));
});

export const DELETE = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const ok = await repos.planned.softDelete(id);
  return ok ? json({ ok: true }) : json({ error: 'not_found' }, { status: 404 });
});
