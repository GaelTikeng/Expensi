import { z } from 'zod';

import { CURRENCY_CODES } from '@/src/lib/currencies';

import { clerk, json, withAuth } from '@/src/server/auth/clerk';
import { db } from '@/src/server/db/client';
import type { User } from '@/src/server/db/schema';
import { UsersRepository } from '@/src/server/repositories/users';
import { deleteAccountData } from '@/src/server/services/account';
import { isKnownTimezone } from '@/src/lib/timezones';

function profile(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    defaultCurrency: user.defaultCurrency,
    timezone: user.timezone,
  };
}

/** The resolved `users` row for the caller. */
export const GET = withAuth(async (_req, { user }) => json(profile(user)));

const patchSchema = z
  .object({
    defaultCurrency: z.string().length(3).toUpperCase().pipe(z.enum(CURRENCY_CODES)).optional(),
    timezone: z.string().refine(isKnownTimezone, 'Unknown timezone').optional(),
    expoPushToken: z.string().min(1).nullable().optional(),
  })
  .strict();

/** F1.4: preferences. Currency codes are validated by the schema (D14). */
export const PATCH = withAuth(async (req, { user }) => {
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return json({ error: 'invalid_body', issues: body.error.issues }, { status: 400 });
  }
  const updated = await new UsersRepository(db).updateProfile(user.id, body.data);
  return json(profile(updated ?? user));
});

/**
 * F1.6: delete my account. Purges S3 and our rows first, then deletes the
 * Clerk user so the session dies. The webhook that Clerk fires afterwards
 * finds nothing left and no-ops.
 */
export const DELETE = withAuth(async (_req, { user, clerkUserId }) => {
  await deleteAccountData(user);
  await clerk.users.deleteUser(clerkUserId);
  return json({ ok: true });
});
