import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { importItemPatchSchema } from '@/src/lib/schemas/import';
import { isUuid } from '@/src/lib/uuid';

/** F3.9 inline edit of one staged row. Marks it `editedByUser`. */
export const PATCH = withAuth(async (req, { repos }, { id, itemId }) => {
  if (!isUuid(id) || !isUuid(itemId)) return json({ error: 'not_found' }, { status: 404 });
  const parsed = importItemPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return json({ error: 'empty_patch' }, { status: 400 });

  const imp = await repos.imports.findById(id);
  if (!imp) return json({ error: 'not_found' }, { status: 404 });
  if (imp.status !== 'review') return json({ error: 'import_not_reviewable' }, { status: 409 });
  if (parsed.data.categoryId && !(await repos.categories.findById(parsed.data.categoryId))) {
    return json({ error: 'category_not_found' }, { status: 400 });
  }

  const patch = { ...parsed.data, reviewState: parsed.data.reviewState ?? ('edited' as const) };
  const row = await repos.imports.updateItem(id, itemId, patch);
  return row ? json(row) : json({ error: 'not_found' }, { status: 404 });
});
