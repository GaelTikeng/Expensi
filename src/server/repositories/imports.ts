import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { importItems, imports, type Import, type ImportItem } from '../db/schema';
import type { ImportItemPatch } from '@/src/lib/schemas/import';
import { UserScopedRepository } from './base';

export class ImportsRepository extends UserScopedRepository {
  private scope() {
    return and(eq(imports.userId, this.userId), sql`${imports.deletedAt} is null`);
  }

  async list(limit = 50, offset = 0): Promise<(Import & { itemCount: number })[]> {
    const rows = await this.db
      .select({
        imp: imports,
        itemCount: sql<number>`(select count(*)::int from ${importItems} where ${importItems.importId} = ${imports.id})`,
      })
      .from(imports)
      .where(this.scope())
      .orderBy(desc(imports.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({ ...r.imp, itemCount: r.itemCount }));
  }

  async findById(id: string): Promise<Import | undefined> {
    const [row] = await this.db.select().from(imports).where(and(this.scope(), eq(imports.id, id))).limit(1);
    return row;
  }

  async create(input: Omit<typeof imports.$inferInsert, 'userId'>): Promise<{ row: Import; created: boolean }> {
    const [row] = await this.db
      .insert(imports)
      .values({ ...input, userId: this.userId })
      .onConflictDoNothing({ target: imports.id })
      .returning();
    if (row) return { row, created: true };
    const existing = await this.findById(input.id);
    if (!existing) throw new Error('Import id conflict with another user');
    return { row: existing, created: false };
  }

  async update(id: string, patch: Partial<typeof imports.$inferInsert>): Promise<Import | undefined> {
    const [row] = await this.db
      .update(imports)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(this.scope(), eq(imports.id, id)))
      .returning();
    return row;
  }

  listItems(importId: string): Promise<ImportItem[]> {
    return this.db
      .select()
      .from(importItems)
      .where(and(eq(importItems.userId, this.userId), eq(importItems.importId, importId)))
      .orderBy(asc(importItems.lineIndex));
  }

  async replaceItems(importId: string, rows: Omit<typeof importItems.$inferInsert, 'userId' | 'importId'>[]): Promise<void> {
    await this.db
      .delete(importItems)
      .where(and(eq(importItems.userId, this.userId), eq(importItems.importId, importId)));
    if (rows.length === 0) return;
    await this.db.insert(importItems).values(rows.map((r) => ({ ...r, userId: this.userId, importId })));
  }

  async updateItem(importId: string, itemId: string, patch: ImportItemPatch): Promise<ImportItem | undefined> {
    const [row] = await this.db
      .update(importItems)
      .set({ ...patch, editedByUser: true, updatedAt: new Date() })
      .where(and(eq(importItems.userId, this.userId), eq(importItems.importId, importId), eq(importItems.id, itemId)))
      .returning();
    return row;
  }

  async setReviewStates(importId: string, acceptedIds: string[]): Promise<void> {
    await this.db
      .update(importItems)
      .set({ reviewState: 'rejected', updatedAt: new Date() })
      .where(and(eq(importItems.userId, this.userId), eq(importItems.importId, importId)));
    if (acceptedIds.length === 0) return;
    await this.db
      .update(importItems)
      .set({ reviewState: 'accepted', updatedAt: new Date() })
      .where(and(eq(importItems.userId, this.userId), eq(importItems.importId, importId), inArray(importItems.id, acceptedIds)));
  }
}
