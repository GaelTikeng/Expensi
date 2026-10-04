import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';

import { plannedExpenses, recurringCharges, type PlannedExpense, type RecurringCharge, type User } from '../db/schema';
import { notFound } from '../errors';
import { clampDayOfMonth, endOfMonth, zonedTimeToUtc, type ISODate } from '@/src/lib/dates';
import type { RecurringPatch } from '@/src/lib/schemas/recurring';
import { UserScopedRepository } from './base';

type NewRecurring = typeof recurringCharges.$inferInsert;

export class RecurringRepository extends UserScopedRepository {
  private scope() {
    return and(eq(recurringCharges.userId, this.userId), isNull(recurringCharges.deletedAt));
  }

  list(): Promise<RecurringCharge[]> {
    return this.db.select().from(recurringCharges).where(this.scope()).orderBy(asc(recurringCharges.dayOfMonth), asc(recurringCharges.name));
  }

  async findById(id: string): Promise<RecurringCharge | undefined> {
    const [row] = await this.db.select().from(recurringCharges).where(and(this.scope(), eq(recurringCharges.id, id))).limit(1);
    return row;
  }

  async create(input: Omit<NewRecurring, 'userId'>): Promise<{ row: RecurringCharge; created: boolean }> {
    const [row] = await this.db
      .insert(recurringCharges)
      .values({ ...input, userId: this.userId })
      .onConflictDoNothing({ target: recurringCharges.id })
      .returning();
    if (row) return { row, created: true };
    const existing = await this.findById(input.id);
    if (!existing) throw new Error('Recurring id conflict with another user');
    return { row: existing, created: false };
  }

  async update(id: string, patch: RecurringPatch): Promise<RecurringCharge> {
    const current = await this.findById(id);
    if (!current) throw notFound('recurring charge');
    const [row] = await this.db
      .update(recurringCharges)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(this.scope(), eq(recurringCharges.id, id)))
      .returning();
    return row;
  }

  /** Soft-deletes the charge and removes its not-yet-paid future plans. */
  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(recurringCharges)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(this.scope(), eq(recurringCharges.id, id)))
      .returning({ id: recurringCharges.id });
    if (rows.length === 0) return false;
    await this.db
      .update(plannedExpenses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(plannedExpenses.userId, this.userId), eq(plannedExpenses.recurringChargeId, id), eq(plannedExpenses.status, 'planned')));
    return true;
  }

  /**
   * F6.3: creates one planned expense per active charge for the month that
   * starts at `periodStart`. Idempotent through the unique
   * (recurring_charge_id, period_start) index; returns only rows created now
   * so the client can schedule their reminders.
   */
  async materialize(user: User, periodStart: ISODate): Promise<PlannedExpense[]> {
    const periodEnd = endOfMonth(periodStart);
    const charges = await this.db
      .select()
      .from(recurringCharges)
      .where(
        and(
          this.scope(),
          eq(recurringCharges.isActive, true),
          lte(recurringCharges.startsOn, periodEnd),
          or(isNull(recurringCharges.endsOn), gte(recurringCharges.endsOn, periodStart)),
        ),
      );
    if (charges.length === 0) return [];

    const rows = charges.map((c) => {
      const date = clampDayOfMonth(periodStart, c.dayOfMonth);
      return {
        id: crypto.randomUUID(),
        userId: this.userId,
        title: c.name,
        amountMinor: c.amountMinor,
        currency: c.currency,
        categoryId: c.categoryId,
        scheduledAt: zonedTimeToUtc(date, c.reminderTime.slice(0, 5), user.timezone),
        payee: c.payee,
        reason: c.notes,
        status: 'planned' as const,
        recurringChargeId: c.id,
        periodStart,
      };
    });
    return this.db
      .insert(plannedExpenses)
      .values(rows)
      .onConflictDoNothing({ target: [plannedExpenses.recurringChargeId, plannedExpenses.periodStart] })
      .returning();
  }
}
