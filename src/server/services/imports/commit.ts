import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client';
import { expenses, importItems, imports, type Import, type ImportItem } from '../../db/schema';
import { HttpError } from '../../errors';
import type { Repositories } from '../../repositories';

/**
 * F3.11: promotes accepted staged rows to the ledger atomically. neon-http has
 * no interactive transactions, so this uses `db.batch`, which runs as one
 * transaction on the server.
 */
export async function commitImport(
  repos: Repositories,
  userId: string,
  imp: Import,
  acceptedItemIds: string[],
): Promise<{ created: number; expenseIds: string[] }> {
  if (imp.status === 'committed') throw new HttpError(409, 'import_already_committed');
  if (imp.status !== 'review') throw new HttpError(409, 'import_not_reviewable', `Import is ${imp.status}`);

  const items = await repos.imports.listItems(imp.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const accepted: ImportItem[] = [];
  for (const id of acceptedItemIds) {
    const item = byId.get(id);
    if (!item) throw new HttpError(400, 'unknown_item', `Item ${id} is not part of this import`);
    if (item.lineKind !== 'expense') throw new HttpError(400, 'item_not_expense', `Line ${item.lineIndex + 1} is a ${item.lineKind}`);
    if (item.amountMinor == null || item.amountMinor <= 0) throw new HttpError(400, 'item_missing_amount', `Line ${item.lineIndex + 1} has no amount`);
    if (!item.occurredOn) throw new HttpError(400, 'item_missing_date', `Line ${item.lineIndex + 1} has no date`);
    accepted.push(item);
  }

  const now = new Date();
  const rows = accepted.map((item) => ({
    id: randomUUID(),
    userId,
    amountMinor: item.amountMinor!,
    currency: item.currency ?? 'XAF',
    occurredOn: item.occurredOn!,
    description: item.description?.trim() || item.rawText.slice(0, 200) || 'Imported expense',
    payee: item.payee,
    categoryId: item.categoryId,
    source: 'import' as const,
    importItemId: item.id,
  }));
  const acceptedIds = accepted.map((i) => i.id);
  const rejectedIds = items.filter((i) => !acceptedIds.includes(i.id)).map((i) => i.id);

  await db.batch([
    db.insert(expenses).values(rows),
    db
      .update(importItems)
      .set({ reviewState: 'accepted', updatedAt: now })
      .where(and(eq(importItems.userId, userId), inArray(importItems.id, acceptedIds))),
    ...(rejectedIds.length
      ? [
          db
            .update(importItems)
            .set({ reviewState: 'rejected', updatedAt: now })
            .where(and(eq(importItems.userId, userId), inArray(importItems.id, rejectedIds))),
        ]
      : []),
    db
      .update(imports)
      .set({ status: 'committed', committedAt: now, updatedAt: now })
      .where(and(eq(imports.userId, userId), eq(imports.id, imp.id))),
  ]);

  await repos.recaps.markStaleFor([...new Set(rows.map((r) => r.occurredOn))]);
  return { created: rows.length, expenseIds: rows.map((r) => r.id) };
}
