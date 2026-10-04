import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';

import { expenses, type Expense, type NewExpense } from '../db/schema';
import { UserScopedRepository } from './base';

export interface ListExpensesFilter {
  /** Inclusive, YYYY-MM-DD. */
  from?: string;
  /** Inclusive, YYYY-MM-DD. */
  to?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export class ExpensesRepository extends UserScopedRepository {
  private scope() {
    return and(eq(expenses.userId, this.userId), isNull(expenses.deletedAt));
  }

  async list(filter: ListExpensesFilter = {}): Promise<Expense[]> {
    const conditions = [this.scope()];
    if (filter.from) conditions.push(gte(expenses.occurredOn, filter.from));
    if (filter.to) conditions.push(lte(expenses.occurredOn, filter.to));
    if (filter.categoryId) conditions.push(eq(expenses.categoryId, filter.categoryId));

    return this.db
      .select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.occurredOn), desc(expenses.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);
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
  async create(input: Omit<NewExpense, 'userId'>): Promise<Expense> {
    const [row] = await this.db
      .insert(expenses)
      .values({ ...input, userId: this.userId })
      .onConflictDoNothing({ target: expenses.id })
      .returning();
    if (row) return row;
    const existing = await this.findById(input.id);
    if (!existing) throw new Error('Expense id conflict with another user');
    return existing;
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

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(expenses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(this.scope(), eq(expenses.id, id)))
      .returning({ id: expenses.id });
    return rows.length > 0;
  }
}
