import { json, queryObject, readJson, withAuth } from '@/src/server/auth/clerk';
import { expenseInputSchema, expenseListQuerySchema } from '@/src/lib/schemas/expense';

/** F2.2: list, newest first, with date/category/source filters and search. */
export const GET = withAuth(async (req, { repos }) => {
  const parsed = expenseListQuerySchema.safeParse(queryObject(req));
  if (!parsed.success) return json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  return json(await repos.expenses.list(parsed.data));
});

/**
 * F2.1: create. Idempotent on the client-generated id: a replay returns 200
 * with the existing row, a first write returns 201.
 */
export const POST = withAuth(async (req, { repos }) => {
  const parsed = expenseInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });

  if (parsed.data.categoryId && !(await repos.categories.findById(parsed.data.categoryId))) {
    return json({ error: 'category_not_found' }, { status: 400 });
  }

  const { row, created } = await repos.expenses.create({ ...parsed.data, source: 'manual' });
  if (created) await repos.recaps.markStaleFor([row.occurredOn]);
  return json(row, { status: created ? 201 : 200 });
});
