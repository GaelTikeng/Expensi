import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';

import { attachments, expenses, type Expense, type NewExpense } from '../db/schema';
import type { ExpenseListQuery } from '@/src/lib/schemas/expense';
import { AttachmentsRepository } from './attachments';
import { UserScopedRepository } from './base';

export type ExpenseWithCounts = Expense & { attachmentCount: number };

export class ExpensesRepository extends UserScopedRepository {
  private scope() {
    return and(eq(expenses.userId, this.userId), isNull(expenses.deletedAt));
  }

  /** `exists (…)` over confirmed, live attachments for the current expense row. */
  private proofExists() {
    return sql`exists (select 1 from ${attachments} where ${attachments.expenseId} = ${expenses.id} and ${attachments.deletedAt} is null and ${attachments.uploadedAt} is not null)`;
  }

  private async decorate(rows: Expense[]): Promise<ExpenseWithCounts[]> {
    const counts = await new AttachmentsRepository(this.db, this.userId).countsForExpenses(rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, attachmentCount: counts.get(r.id) ?? 0 }));
  }

  /**
   * Newest first. Fetches `limit + 1` rows so the caller can tell whether a
   * next page exists without a COUNT.
   */
  async list(q: ExpenseListQuery): Promise<{ items: ExpenseWithCounts[]; nextOffset: number | null }> {
    const conditions = [this.scope()];
    if (q.from) conditions.push(gte(expenses.occurredOn, q.from));
    if (q.to) conditions.push(lte(expenses.occurredOn, q.to));
    if (q.categoryId) conditions.push(eq(expenses.categoryId, q.categoryId));
    if (q.source) conditions.push(eq(expenses.source, q.source));
    if (q.hasAttachment !== undefined) {
      conditions.push(q.hasAttachment ? this.proofExists() : sql`not ${this.proofExists()}`);
    }
    if (q.q) {
      const pattern = `%${q.q.replace(/[%_]/g, '\\$&')}%`;
      conditions.push(or(ilike(expenses.description, pattern), ilike(expenses.payee, pattern))!);
    }

    const rows = await this.db
      .select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.occurredOn), desc(expenses.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset);

    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    return { items: await this.decorate(page), nextOffset: hasMore ? q.offset + q.limit : null };
  }

  async findById(id: string): Promise<ExpenseWithCounts | undefined> {
    const [row] = await this.db
      .select()
      .from(expenses)
      .where(and(this.scope(), eq(expenses.id, id)))
      .limit(1);
    if (!row) return undefined;
    const [decorated] = await this.decorate([row]);
    return decorated;
  }

  /**
   * Idempotent on the client-generated id: replaying the same POST returns the
   * existing row instead of raising a unique violation.
   */
  async create(input: Omit<NewExpense, 'userId'>): Promise<{ row: ExpenseWithCounts; created: boolean }> {
    const [row] = await this.db
      .insert(expenses)
      .values({ ...input, userId: this.userId })
      .onConflictDoNothing({ target: expenses.id })
      .returning();
    if (row) return { row: { ...row, attachmentCount: 0 }, created: true };
    const existing = await this.findById(input.id);
    if (!existing) throw new Error('Expense id conflict with another user');
    return { row: existing, created: false };
  }

  async update(
    id: string,
    patch: Partial<Omit<NewExpense, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<ExpenseWithCounts | undefined> {
    const [row] = await this.db
      .update(expenses)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(this.scope(), eq(expenses.id, id)))
      .returning();
    if (!row) return undefined;
    const [decorated] = await this.decorate([row]);
    return decorated;
  }

  async softDelete(id: string): Promise<Expense | undefined> {
    const [row] = await this.db
      .update(expenses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(this.scope(), eq(expenses.id, id)))
      .returning();
    return row;
  }
}
