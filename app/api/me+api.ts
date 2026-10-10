import { clerk, json, readJson, withAuth } from '@/src/server/auth/clerk';
import { db } from '@/src/server/db/client';
import type { User } from '@/src/server/db/schema';
import { UsersRepository } from '@/src/server/repositories/users';
import { deleteAccountData } from '@/src/server/services/account';
import { deleteObject, headObject, isStorageConfigured, presignGet } from '@/src/server/storage/s3';
import { isAvatarKeyOf, MAX_AVATAR_BYTES, mePatchSchema, type MeProfile } from '@/src/lib/schemas/profile';

const AVATAR_URL_TTL = 900;

async function profile(user: User): Promise<MeProfile> {
  const avatarUrl = user.avatarKey && isStorageConfigured() ? await presignGet(user.avatarKey, AVATAR_URL_TTL) : null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    phone: user.phone,
    defaultCurrency: user.defaultCurrency,
    timezone: user.timezone,
    imageUrl: user.imageUrl,
    avatarKey: user.avatarKey,
    avatarUrl,
  };
}

/** The resolved `users` row for the caller. */
export const GET = withAuth(async (_req, { user }) => json(await profile(user)));

/**
 * F1.4 preferences and E15 profile fields. An `avatarKey` must come from
 * `POST /api/me/avatar` and the object must have landed; the previous custom
 * avatar is deleted best-effort. `avatarKey: null` removes the custom avatar.
 */
export const PATCH = withAuth(async (req, { user }) => {
  const body = mePatchSchema.safeParse(await readJson(req));
  if (!body.success) return json({ error: 'invalid_body', issues: body.error.issues }, { status: 400 });
  const patch = body.data;

  if (patch.avatarKey) {
    if (!isAvatarKeyOf(user.id, patch.avatarKey)) return json({ error: 'invalid_avatar_key' }, { status: 400 });
    let head;
    try {
      head = await headObject(patch.avatarKey);
    } catch {
      return json({ error: 'object_missing', message: 'Upload has not reached storage yet' }, { status: 409 });
    }
    if (head.contentLength == null || head.contentLength > MAX_AVATAR_BYTES || (head.contentType && head.contentType !== 'image/jpeg')) {
      await deleteObject(patch.avatarKey).catch(() => undefined);
      return json({ error: 'invalid_avatar_object' }, { status: 400 });
    }
  }
  const previousAvatar = patch.avatarKey !== undefined && user.avatarKey && user.avatarKey !== patch.avatarKey ? user.avatarKey : null;

  const updated = await new UsersRepository(db).updateProfile(user.id, patch);
  if (previousAvatar) await deleteObject(previousAvatar).catch(() => undefined);
  return json(await profile(updated ?? user));
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
