import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { buildImportKey, presignPut } from '@/src/server/storage/s3';
import { importPresignSchema } from '@/src/lib/schemas/import';

/** Presigned PUT for a spreadsheet or PDF. No DB row yet; `POST /api/imports` creates it. */
export const POST = withAuth(async (req, { user }) => {
  const parsed = importPresignSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const key = buildImportKey(user.id, parsed.data.id, parsed.data.mimeType);
  const { url, expiresAt } = await presignPut({ key, contentType: parsed.data.mimeType, contentLength: parsed.data.sizeBytes });
  return json({ id: parsed.data.id, key, uploadUrl: url, expiresAt: expiresAt.toISOString() }, { status: 201 });
});
