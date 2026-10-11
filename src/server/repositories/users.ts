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
    imageUrl?: string | null;
  }): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        clerkUserId: input.clerkUserId,
        email: input.email ?? null,
        displayName: input.displayName ?? null,
        imageUrl: input.imageUrl ?? null,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          email: input.email ?? undefined,
          // The provider picture follows the provider; a name the user typed
          // in the app is kept (displayName is only set when still empty).
          imageUrl: input.imageUrl === undefined ? undefined : input.imageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async updateProfile(
    userId: string,
    patch: Partial<Pick<User, 'defaultCurrency' | 'timezone' | 'expoPushToken' | 'displayName' | 'phone' | 'avatarKey' | 'imageUrl' | 'language'>>,
  ): Promise<User | undefined> {
    const [row] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }
}
