import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';

import { attachments, type Attachment } from '../db/schema';
import type { AttachmentKind } from '@/src/lib/schemas/attachment';
import { UserScopedRepository } from './base';

export class AttachmentsRepository extends UserScopedRepository {
  private scope() {
    return and(eq(attachments.userId, this.userId), isNull(attachments.deletedAt));
  }

  async findById(id: string): Promise<Attachment | undefined> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(and(this.scope(), eq(attachments.id, id)))
      .limit(1);
    return row;
  }

  /** Row exists before the bytes do; `uploadedAt` stays null until confirm. */
  async createPending(input: {
    id: string;
    storageKey: string;
    kind: AttachmentKind;
    mimeType: string;
    sizeBytes: number;
    originalFilename?: string | null;
    expenseId?: string | null;
  }): Promise<Attachment> {
    const [row] = await this.db
      .insert(attachments)
      .values({ ...input, userId: this.userId })
      .returning();
    return row;
  }

  async confirm(
    id: string,
    input: { sizeBytes: number; expenseId?: string | null },
  ): Promise<Attachment | undefined> {
    const [row] = await this.db
      .update(attachments)
      .set({
        uploadedAt: new Date(),
        sizeBytes: input.sizeBytes,
        ...(input.expenseId !== undefined ? { expenseId: input.expenseId } : {}),
        updatedAt: new Date(),
      })
      .where(and(this.scope(), eq(attachments.id, id)))
      .returning();
    return row;
  }

  listForExpense(expenseId: string): Promise<Attachment[]> {
    return this.db
      .select()
      .from(attachments)
      .where(and(this.scope(), eq(attachments.expenseId, expenseId), isNotNull(attachments.uploadedAt)))
      .orderBy(desc(attachments.createdAt));
  }

  async softDelete(id: string): Promise<Attachment | undefined> {
    const [row] = await this.db
      .update(attachments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(this.scope(), eq(attachments.id, id)))
      .returning();
    return row;
  }

  /** Confirmed-attachment counts for a set of expenses, in one query. */
  async countsForExpenses(expenseIds: string[]): Promise<Map<string, number>> {
    if (expenseIds.length === 0) return new Map();
    const rows = await this.db
      .select({ expenseId: attachments.expenseId, n: sql<number>`count(*)::int` })
      .from(attachments)
      .where(
        and(this.scope(), isNotNull(attachments.uploadedAt), inArray(attachments.expenseId, expenseIds)),
      )
      .groupBy(attachments.expenseId);
    return new Map(rows.flatMap((r) => (r.expenseId ? [[r.expenseId, r.n] as const] : [])));
  }

  /** Presigned but never confirmed; candidates for the orphan sweep (F2b.7). */
  listStalePending(olderThan: Date): Promise<Attachment[]> {
    return this.db
      .select()
      .from(attachments)
      .where(and(this.scope(), isNull(attachments.uploadedAt), lt(attachments.createdAt, olderThan)));
  }
}
