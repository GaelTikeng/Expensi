import { eq } from 'drizzle-orm';

import { db } from '../db/client';
import { users, type User } from '../db/schema';
import { deletePrefix, isStorageConfigured, userPrefix } from '../storage/s3';

/**
 * Removes everything we hold for a user. Shared by the in-app "delete my
 * account" route (F1.6) and the Clerk `user.deleted` webhook (F1.5), so either
 * entry point leaves the same end state.
 *
 * Order matters: purge S3 first. If the DB delete then fails, the row still
 * exists and the operation can be retried; the reverse would orphan files.
 * All child rows go with the `users` row via ON DELETE CASCADE.
 *
 * When S3 is not configured, uploads were impossible, so there is nothing to
 * purge; skipping avoids failing the whole deletion on a 503.
 */
export async function deleteAccountData(user: Pick<User, 'id'>): Promise<{ filesDeleted: number }> {
  const filesDeleted = isStorageConfigured() ? await deletePrefix(userPrefix(user.id)) : 0;
  await db.delete(users).where(eq(users.id, user.id));
  return { filesDeleted };
}
