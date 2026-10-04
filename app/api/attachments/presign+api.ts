import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { buildObjectKey, presignPut } from '@/src/server/storage/s3';
import { kindForMime, presignRequestSchema, type PresignResponse } from '@/src/lib/schemas/attachment';

/**
 * F2b.1: step one of an upload. Records a pending row and returns a presigned
 * PUT constrained to the declared type and size. Idempotent on `id`: a retry
 * before confirm re-signs the same key; after confirm it is a 409.
 */
export const POST = withAuth(async (req, { user, repos }) => {
  const parsed = presignRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;

  if (input.expenseId && !(await repos.expenses.findById(input.expenseId))) {
    return json({ error: 'expense_not_found' }, { status: 400 });
  }

  let row = await repos.attachments.findById(input.id);
  if (row?.uploadedAt) return json({ error: 'already_uploaded' }, { status: 409 });
  if (!row) {
    row = await repos.attachments.createPending({
      id: input.id,
      storageKey: buildObjectKey(user.id, input.id, input.mimeType),
      kind: kindForMime(input.mimeType),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      originalFilename: input.originalFilename ?? null,
      expenseId: input.expenseId ?? null,
    });
  }

  const { url, expiresAt } = await presignPut({
    key: row.storageKey,
    contentType: row.mimeType,
    contentLength: input.sizeBytes,
  });
  const body: PresignResponse = { id: row.id, key: row.storageKey, uploadUrl: url, expiresAt: expiresAt.toISOString() };
  return json(body, { status: 201 });
});
