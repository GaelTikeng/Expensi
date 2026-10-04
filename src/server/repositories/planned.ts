import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import { attachments, expenses, plannedExpenses, type PlannedExpense } from '../db/schema';
import { HttpError, notFound } from '../errors';
import type { PlannedListQuery, PlannedMonthSummary, PlannedPatch } from '@/src/lib/schemas/planned';
import { UserScopedRepository } from './base';

type NewPlanned = typeof plannedExpenses.$inferInsert;

export class PlannedRepository extends UserScopedRepository {
  private scope() {
    return and(eq(plannedExpenses.userId, this.userId), isNull(plannedExpenses.deletedAt));
  }

  async list(q: PlannedListQuery): Promise<{ items: PlannedExpense[]; nextOffset: number | null }> {
    const conditions = [this.scope()];
    if (q.status !== 'all') conditions.push(eq(plannedExpenses.status, q.status));
    if (q.from) conditions.push(gte(plannedExpenses.scheduledAt, new Date(q.from)));
    if (q.to) conditions.push(lte(plannedExpenses.scheduledAt, new Date(q.to)));
    const rows = await this.db
      .select()
      .from(plannedExpenses)
      .where(and(...conditions))
      .orderBy(q.status === 'planned' ? asc(plannedExpenses.scheduledAt) : desc(plannedExpenses.scheduledAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    const hasMore = rows.length > q.limit;
    return { items: hasMore ? rows.slice(0, q.limit) : rows, nextOffset: hasMore ? q.offset + q.limit : null };
  }

  async findById(id: string): Promise<PlannedExpense | undefined> {
    const [row] = await this.db.select().from(plannedExpenses).where(and(this.scope(), eq(plannedExpenses.id, id))).limit(1);
    return row;
  }

  async create(input: Omit<NewPlanned, 'userId'>): Promise<{ row: PlannedExpense; created: boolean }> {
    const [row] = await this.db
      .insert(plannedExpenses)
      .values({ ...input, userId: this.userId })
      .onConflictDoNothing({ target: plannedExpenses.id })
      .returning();
    if (row) return { row, created: true };
    const existing = await this.findById(input.id);
    if (!existing) throw new Error('Planned id conflict with another user');
    return { row: existing, created: false };
  }

  async update(id: string, patch: PlannedPatch & { scheduledAt?: string }): Promise<PlannedExpense> {
    const current = await this.findById(id);
    if (!current) throw notFound('planned expense');
    if (current.status === 'done') throw new HttpError(409, 'planned_already_done', 'Completed plans cannot be edited');
    const { scheduledAt, ...rest } = patch;
    const [row] = await this.db
      .update(plannedExpenses)
      .set({ ...rest, ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}), updatedAt: new Date() })
      .where(and(this.scope(), eq(plannedExpenses.id, id)))
      .returning();
    return row;
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(plannedExpenses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(this.scope(), eq(plannedExpenses.id, id)))
      .returning({ id: plannedExpenses.id });
    return rows.length > 0;
  }

  /**
   * F5.6 + F2b.8: one batch — insert the real expense, flip the plan to done,
   * and link any pre-uploaded attachments. neon-http batches run as a single
   * transaction server-side.
   */
  async complete(
    plan: PlannedExpense,
    input: { expenseId: string; amountMinor: number; occurredOn: string; paidOn: string | null; notes: string | null; attachmentIds: string[] },
  ): Promise<{ plan: PlannedExpense; expenseId: string }> {
    if (plan.status === 'done') throw new HttpError(409, 'planned_already_done');
    const now = new Date();
    const expenseRow = {
      id: input.expenseId,
      userId: this.userId,
      amountMinor: input.amountMinor,
      currency: plan.currency,
      occurredOn: input.occurredOn,
      paidOn: input.paidOn,
      description: plan.title,
      payee: plan.payee,
      categoryId: plan.categoryId,
      notes: input.notes ?? plan.reason,
      source: plan.recurringChargeId ? ('recurring' as const) : ('planned' as const),
      recurringChargeId: plan.recurringChargeId,
    };
    await this.db.batch([
      this.db.insert(expenses).values(expenseRow),
      this.db
        .update(plannedExpenses)
        .set({ status: 'done', completedExpenseId: input.expenseId, completedAt: now, updatedAt: now })
        .where(and(this.scope(), eq(plannedExpenses.id, plan.id))),
      ...(input.attachmentIds.length
        ? [
            this.db
              .update(attachments)
              .set({ expenseId: input.expenseId, updatedAt: now })
              .where(and(eq(attachments.userId, this.userId), isNull(attachments.expenseId), inArray(attachments.id, input.attachmentIds))),
          ]
        : []),
    ]);
    const updated = await this.findById(plan.id);
    return { plan: updated!, expenseId: input.expenseId };
  }

  /** F5.7: per-month totals in the user's default currency for one year. */
  async summaryByMonth(year: number, currency: string): Promise<PlannedMonthSummary[]> {
    const month = sql<string>`to_char(${plannedExpenses.scheduledAt}, 'YYYY-MM')`;
    const rows = await this.db
      .select({
        month,
        status: plannedExpenses.status,
        total: sql<number>`coalesce(sum(${plannedExpenses.amountMinor}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(plannedExpenses)
      .where(
        and(
          this.scope(),
          eq(plannedExpenses.currency, currency),
          gte(plannedExpenses.scheduledAt, new Date(Date.UTC(year, 0, 1))),
          lte(plannedExpenses.scheduledAt, new Date(Date.UTC(year, 11, 31, 23, 59, 59))),
        ),
      )
      .groupBy(month, plannedExpenses.status);

    const out = new Map<string, PlannedMonthSummary>();
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      out.set(key, { month: key, currency, plannedMinor: 0, doneMinor: 0, skippedMinor: 0, plannedCount: 0, doneCount: 0, skippedCount: 0 });
    }
    for (const r of rows) {
      const s = out.get(r.month);
      if (!s) continue;
      const total = Number(r.total);
      if (r.status === 'planned') {
        s.plannedMinor += total;
        s.plannedCount += r.count;
      } else if (r.status === 'done') {
        s.doneMinor += total;
        s.doneCount += r.count;
      } else {
        s.skippedMinor += total;
        s.skippedCount += r.count;
      }
    }
    return [...out.values()];
  }

  /** Current-month materialised rows for a set of charges (F6.4). */
  async forChargesInPeriod(chargeIds: string[], periodStart: string): Promise<Map<string, PlannedExpense>> {
    if (chargeIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(plannedExpenses)
      .where(and(this.scope(), inArray(plannedExpenses.recurringChargeId, chargeIds), eq(plannedExpenses.periodStart, periodStart)));
    return new Map(rows.flatMap((r) => (r.recurringChargeId ? [[r.recurringChargeId, r] as const] : [])));
  }
}
