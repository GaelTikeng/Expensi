import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { recurringToDto } from '@/src/server/services/planned/dto';
import { isoDateInZone, startOfMonth } from '@/src/lib/dates';
import { recurringInputSchema } from '@/src/lib/schemas/recurring';

/** F6.1 + F6.4: charges with this month's paid / unpaid status. */
export const GET = withAuth(async (_req, { user, repos }) => {
  const charges = await repos.recurring.list();
  const thisMonth = startOfMonth(isoDateInZone(new Date(), user.timezone));
  const current = await repos.planned.forChargesInPeriod(
    charges.map((c) => c.id),
    thisMonth,
  );
  return json({ periodStart: thisMonth, items: charges.map((c) => recurringToDto(c, current.get(c.id))) });
});

export const POST = withAuth(async (req, { repos }) => {
  const parsed = recurringInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.categoryId && !(await repos.categories.findById(parsed.data.categoryId))) {
    return json({ error: 'category_not_found' }, { status: 400 });
  }
  const { row, created } = await repos.recurring.create(parsed.data);
  return json(recurringToDto(row, undefined), { status: created ? 201 : 200 });
});
