import { randomUUID } from 'node:crypto';

import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { presignPut } from '@/src/server/storage/s3';
import { avatarPresignSchema, avatarKeyFor, type AvatarPresignResponse } from '@/src/lib/schemas/profile';

/**
 * E15 F15.2: step one of an avatar change. Returns a presigned PUT for a
 * fresh key under the user's prefix; the client uploads, then confirms with
 * `PATCH /api/me { avatarKey }`, which checks the object landed and drops
 * the previous one. A new key per upload sidesteps stale image caches.
 */
export const POST = withAuth(async (req, { user }) => {
  const parsed = avatarPresignSchema.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const key = avatarKeyFor(user.id, randomUUID());
  const { url, expiresAt } = await presignPut({ key, contentType: 'image/jpeg', contentLength: parsed.data.sizeBytes });
  const body: AvatarPresignResponse = { key, uploadUrl: url, expiresAt: expiresAt.toISOString() };
  return json(body, { status: 201 });
});
