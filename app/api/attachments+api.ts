import { json, queryObject, readJson, withAuth } from '@/src/server/auth/clerk';
import type { Attachment } from '@/src/server/db/schema';
import { deleteObject, headObject, presignGet } from '@/src/server/storage/s3';
import { confirmRequestSchema, MAX_ATTACHMENT_BYTES, type AttachmentDto } from '@/src/lib/schemas/attachment';
import { isUuid } from '@/src/lib/uuid';

export function toDto(a: Attachment): AttachmentDto {
  return {
    id: a.id,
    expenseId: a.expenseId,
    kind: a.kind,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    originalFilename: a.originalFilename,
    uploadedAt: a.uploadedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

const URL_TTL_SECONDS = 900;

/** Confirmed attachments for one expense, each with a 15-minute view URL. */
export const GET = withAuth(async (req, { repos }) => {
  const { expenseId } = queryObject(req);
  if (!expenseId || !isUuid(expenseId)) return json({ error: 'expense_id_required' }, { status: 400 });
  const rows = await repos.attachments.listForExpense(expenseId);
  const expires = new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString();
  const items = await Promise.all(
    rows.map(async (a) => ({ ...toDto(a), url: await presignGet(a.storageKey, URL_TTL_SECONDS), urlExpiresAt: expires })),
  );
  return json({ items });
});

/**
 * F2b.2: step two of an upload. Checks the object really landed and matches
 * what was declared, then marks the row uploaded and links it to an expense.
 */
export const POST = withAuth(async (req, { repos }) => {
  const parsed = confirmRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const { id, expenseId } = parsed.data;

  const row = await repos.attachments.findById(id);
  if (!row) return json({ error: 'not_found' }, { status: 404 });
  if (row.uploadedAt) return json(toDto(row));

  if (expenseId && !(await repos.expenses.findById(expenseId))) {
    return json({ error: 'expense_not_found' }, { status: 400 });
  }

  let head;
  try {
    head = await headObject(row.storageKey);
  } catch {
    return json({ error: 'object_missing', message: 'Upload has not reached storage yet' }, { status: 409 });
  }
  if (head.contentLength == null || head.contentLength > MAX_ATTACHMENT_BYTES) {
    await deleteObject(row.storageKey).catch(() => undefined);
    return json({ error: 'object_too_large' }, { status: 400 });
  }
  if (head.contentType && head.contentType !== row.mimeType) {
    await deleteObject(row.storageKey).catch(() => undefined);
    return json({ error: 'content_type_mismatch' }, { status: 400 });
  }

  const confirmed = await repos.attachments.confirm(id, {
    sizeBytes: head.contentLength,
    expenseId: expenseId === undefined ? undefined : expenseId,
  });
  return json(toDto(confirmed!), { status: 201 });
});
