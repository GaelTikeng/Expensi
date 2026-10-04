import { json, withAuth } from '@/src/server/auth/clerk';
import { presignGet } from '@/src/server/storage/s3';
import { isUuid } from '@/src/lib/uuid';

const TTL = 900;

/** F2b.3: fresh presigned GET for viewing or downloading one attachment. */
export const GET = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const row = await repos.attachments.findById(id);
  if (!row || !row.uploadedAt) return json({ error: 'not_found' }, { status: 404 });
  const url = await presignGet(row.storageKey, TTL);
  return json({ url, expiresAt: new Date(Date.now() + TTL * 1000).toISOString(), mimeType: row.mimeType, kind: row.kind });
});
