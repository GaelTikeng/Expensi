import { eq } from 'drizzle-orm';

import type { Db } from '../db/client';
import { users, type User } from '../db/schema';

/**
 * The one repository that is NOT user-scoped: it is what resolves a Clerk
 * identity into a `users.id` before any scoped repository can exist.
 */
export class UsersRepository {
  constructor(private readonly db: Db) {}

  async findByClerkId(clerkUserId: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({ where: eq(users.clerkUserId, clerkUserId) });
  }

  /** Idempotent: returns the existing row or creates one on first sign-in. */
  async upsertFromClerk(input: {
    clerkUserId: string;
    email?: string | null;
    displayName?: string | null;
  }): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        clerkUserId: input.clerkUserId,
        email: input.email ?? null,
        displayName: input.displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          email: input.email ?? undefined,
          displayName: input.displayName ?? undefined,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }
}
