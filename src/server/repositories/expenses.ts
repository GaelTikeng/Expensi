import { and, desc, eq, gte, ilike, isNull, lte, or } from 'drizzle-orm';

import { expenses, type Expense, type NewExpense } from '../db/schema';
import type { ExpenseListQuery } from '@/src/lib/schemas/expense';
import { UserScopedRepository } from './base';

export class ExpensesRepository extends UserScopedRepository {
  private scope() {
    return and(eq(expenses.userId, this.userId), isNull(expenses.deletedAt));
  }

  /**
   * Newest first. Fetches `limit + 1` rows so the caller can tell whether a
   * next page exists without a COUNT.
   */
  async list(q: ExpenseListQuery): Promise<{ items: Expense[]; nextOffset: number | null }> {
    const conditions = [this.scope()];
    if (q.from) conditions.push(gte(expenses.occurredOn, q.from));
    if (q.to) conditions.push(lte(expenses.occurredOn, q.to));
    if (q.categoryId) conditions.push(eq(expenses.categoryId, q.categoryId));
    if (q.source) conditions.push(eq(expenses.source, q.source));
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
    return { items: hasMore ? rows.slice(0, q.limit) : rows, nextOffset: hasMore ? q.offset + q.limit : null };
  }

  async findById(id: string): Promise<Expense | undefined> {
    const [row] = await this.db
      .select()
      .from(expenses)
      .where(and(this.scope(), eq(expenses.id, id)))
      .limit(1);
    return row;
  }

  /**
   * Idempotent on the client-generated id: replaying the same POST returns the
   * existing row instead of raising a unique violation.
   */
  async create(input: Omit<NewExpense, 'userId'>): Promise<{ row: Expense; created: boolean }> {
    const [row] = await this.db
      .insert(expenses)
      .values({ ...input, userId: this.userId })
      .onConflictDoNothing({ target: expenses.id })
      .returning();
    if (row) return { row, created: true };
    const existing = await this.findById(input.id);
    if (!existing) throw new Error('Expense id conflict with another user');
    return { row: existing, created: false };
  }

  async update(
    id: string,
    patch: Partial<Omit<NewExpense, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<Expense | undefined> {
    const [row] = await this.db
      .update(expenses)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(this.scope(), eq(expenses.id, id)))
      .returning();
    return row;
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
