import { json, queryObject, readJson, withAuth } from '@/src/server/auth/clerk';
import { plannedToDto } from '@/src/server/services/planned/dto';
import { plannedInputSchema, plannedListQuerySchema } from '@/src/lib/schemas/planned';

/** F5.1: list. `status=planned` (default, soonest first) | done | skipped | all. */
export const GET = withAuth(async (req, { repos }) => {
  const parsed = plannedListQuerySchema.safeParse(queryObject(req));
  if (!parsed.success) return json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  const { items, nextOffset } = await repos.planned.list(parsed.data);
  return json({ items: items.map(plannedToDto), nextOffset });
});

/** F5.1: create. Idempotent on the client id. */
export const POST = withAuth(async (req, { repos }) => {
  const parsed = plannedInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.categoryId && !(await repos.categories.findById(parsed.data.categoryId))) {
    return json({ error: 'category_not_found' }, { status: 400 });
  }
  const { scheduledAt, ...rest } = parsed.data;
  const { row, created } = await repos.planned.create({ ...rest, scheduledAt: new Date(scheduledAt) });
  return json(plannedToDto(row), { status: created ? 201 : 200 });
});
