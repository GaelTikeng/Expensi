import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { expensePatchSchema } from '@/src/lib/schemas/expense';
import { isUuid } from '@/src/lib/uuid';

export const GET = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const row = await repos.expenses.findById(id);
  return row ? json(row) : json({ error: 'not_found' }, { status: 404 });
});

/** F2.3 + F2.8: partial update; stale-marks both the old and the new period. */
export const PATCH = withAuth(async (req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const parsed = expensePatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return json({ error: 'empty_patch' }, { status: 400 });

  const current = await repos.expenses.findById(id);
  if (!current) return json({ error: 'not_found' }, { status: 404 });

  if (parsed.data.categoryId && !(await repos.categories.findById(parsed.data.categoryId))) {
    return json({ error: 'category_not_found' }, { status: 400 });
  }

  const updated = await repos.expenses.update(id, parsed.data);
  if (!updated) return json({ error: 'not_found' }, { status: 404 });
  await repos.recaps.markStaleFor([current.occurredOn, updated.occurredOn]);
  return json(updated);
});

/** F2.3: soft delete. */
export const DELETE = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const row = await repos.expenses.softDelete(id);
  if (!row) return json({ error: 'not_found' }, { status: 404 });
  await repos.recaps.markStaleFor([row.occurredOn]);
  return json({ ok: true });
});
