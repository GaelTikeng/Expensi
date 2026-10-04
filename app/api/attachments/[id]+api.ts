import { json, withAuth } from '@/src/server/auth/clerk';
import { deleteObject } from '@/src/server/storage/s3';
import { isUuid } from '@/src/lib/uuid';

/** F2b.4: soft-delete the row and remove the object. */
export const DELETE = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const row = await repos.attachments.softDelete(id);
  if (!row) return json({ error: 'not_found' }, { status: 404 });
  // Best effort: the row is already gone from the user's view. A failed object
  // delete is picked up by the orphan sweep.
  await deleteObject(row.storageKey).catch((err) => console.warn('S3 delete failed', row.storageKey, err));
  return json({ ok: true });
});
