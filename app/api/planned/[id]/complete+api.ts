import { randomUUID } from 'node:crypto';

import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { plannedToDto } from '@/src/server/services/planned/dto';
import { isoDateInZone } from '@/src/lib/dates';
import { plannedCompleteSchema } from '@/src/lib/schemas/planned';
import { isUuid } from '@/src/lib/uuid';

/** F5.6: mark as done → creates the real expense and links it. */
export const POST = withAuth(async (req, { user, repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const parsed = plannedCompleteSchema.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });

  const plan = await repos.planned.findById(id);
  if (!plan) return json({ error: 'not_found' }, { status: 404 });

  const input = parsed.data;
  const result = await repos.planned.complete(plan, {
    expenseId: randomUUID(),
    amountMinor: input.amountMinor ?? Number(plan.amountMinor),
    occurredOn: input.occurredOn ?? isoDateInZone(plan.scheduledAt, user.timezone),
    paidOn: input.paidOn ?? null,
    notes: input.notes ?? null,
    attachmentIds: input.attachmentIds ?? [],
  });
  await repos.recaps.markStaleFor([input.occurredOn ?? isoDateInZone(plan.scheduledAt, user.timezone)]);
  return json({ planned: plannedToDto(result.plan), expenseId: result.expenseId }, { status: 201 });
});
