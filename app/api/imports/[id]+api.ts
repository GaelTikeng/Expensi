import { json, withAuth } from '@/src/server/auth/clerk';
import { db } from '@/src/server/db/client';
import { buildDetail } from '@/src/server/services/imports/dto';
import { deleteObject } from '@/src/server/storage/s3';
import { isUuid } from '@/src/lib/uuid';

/** F3.8: status + staged items + duplicate flags + total reconciliation. */
export const GET = withAuth(async (_req, { user, repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const imp = await repos.imports.findById(id);
  if (!imp) return json({ error: 'not_found' }, { status: 404 });
  const items = await repos.imports.listItems(id);
  return json(await buildDetail(db, user.id, imp, items));
});

/** Soft-deletes an import (not its committed expenses) and removes the file. */
export const DELETE = withAuth(async (_req, { repos }, { id }) => {
  if (!isUuid(id)) return json({ error: 'not_found' }, { status: 404 });
  const imp = await repos.imports.findById(id);
  if (!imp) return json({ error: 'not_found' }, { status: 404 });
  await repos.imports.update(id, { deletedAt: new Date() });
  await deleteObject(imp.storageKey).catch(() => undefined);
  return json({ ok: true });
});
