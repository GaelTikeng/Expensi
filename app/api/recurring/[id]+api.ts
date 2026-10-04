import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { recurringToDto } from '@/src/server/services/planned/dto';
import { recurringPatchSchema } from '@/src/lib/schemas/recurring';
import { isUuid } from '@/src/lib/uuid';

export const PATCH = withAuth(async (req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const parsed = recurringPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return json({ error: 'empty_patch' }, { status: 400 });
  if (parsed.data.categoryId && !(await repos.categories.findById(parsed.data.categoryId))) {
    return json({ error: 'category_not_found' }, { status: 400 });
  }
  return json(recurringToDto(await repos.recurring.update(id, parsed.data), undefined));
});

export const DELETE = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const ok = await repos.recurring.softDelete(id);
  return ok ? json({ ok: true }) : json({ error: 'not_found' }, { status: 404 });
});
