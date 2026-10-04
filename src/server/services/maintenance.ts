import { and, inArray, isNull, lt } from 'drizzle-orm';

import { db } from '../db/client';
import { attachments } from '../db/schema';
import { deleteObject } from '../storage/s3';

/**
 * F2b.7 follow-up / F7.7: attachments presigned but never confirmed are
 * orphans (the app crashed, the user cancelled, the network died). Remove
 * their objects, if any landed, and the rows. Runs across all users — this
 * is the one place that legitimately bypasses the user-scoped repositories.
 */
export async function sweepStaleUploads(olderThanHours = 24): Promise<{ scanned: number; deleted: number }> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const rows = await db
    .select({ id: attachments.id, storageKey: attachments.storageKey })
    .from(attachments)
    .where(and(isNull(attachments.uploadedAt), isNull(attachments.deletedAt), lt(attachments.createdAt, cutoff)))
    .limit(500);
  if (rows.length === 0) return { scanned: 0, deleted: 0 };

  let deleted = 0;
  for (const r of rows) {
    try {
      await deleteObject(r.storageKey);
      deleted++;
    } catch {
      // Object may never have been uploaded; that is fine.
    }
  }
  await db.delete(attachments).where(inArray(attachments.id, rows.map((r) => r.id)));
  return { scanned: rows.length, deleted };
}
