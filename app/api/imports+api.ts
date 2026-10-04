import { json, queryObject, readJson, withAuth } from '@/src/server/auth/clerk';
import { importToDto } from '@/src/server/services/imports/dto';
import { importCreateSchema, sourceTypeForMime } from '@/src/lib/schemas/import';

/** F3.12: import history, newest first. */
export const GET = withAuth(async (req, { repos }) => {
  const q = queryObject(req);
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100);
  const offset = Math.max(Number(q.offset) || 0, 0);
  const rows = await repos.imports.list(limit + 1, offset);
  const hasMore = rows.length > limit;
  return json({ items: (hasMore ? rows.slice(0, limit) : rows).map(importToDto), nextOffset: hasMore ? offset + limit : null });
});

/**
 * F3.4: register an uploaded file. The client then calls
 * `POST /api/imports/[id]/process`. Idempotent on the client id.
 */
export const POST = withAuth(async (req, { user, repos }) => {
  const parsed = importCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;
  if (!input.storageKey.startsWith(`users/${user.id}/imports/`)) {
    return json({ error: 'invalid_storage_key' }, { status: 400 });
  }
  const { row, created } = await repos.imports.create({
    id: input.id,
    sourceType: sourceTypeForMime(input.mimeType, input.originalFilename),
    storageKey: input.storageKey,
    originalFilename: input.originalFilename ?? null,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  return json(importToDto(row), { status: created ? 201 : 200 });
});
