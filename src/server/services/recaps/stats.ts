import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import { attachments, categories, expenses, type User } from '../../db/schema';
import { eachDay, periodRange, previousPeriodStart, type ISODate, type RecapPeriod } from '@/src/lib/dates';
import type { RecapStats } from '@/src/lib/schemas/recap';

const sum = sql<number>`coalesce(sum(${expenses.amountMinor}), 0)::bigint`;
const cnt = sql<number>`count(*)::int`;

/**
 * F4.1: everything the recap screen shows, computed in SQL. The model never
 * sees raw rows and never produces a number that is not in this object.
 */
export async function computeRecapStats(db: Db, user: User, period: RecapPeriod, anyDate: ISODate): Promise<RecapStats> {
  const { start, end } = periodRange(period, anyDate);
  const currency = user.defaultCurrency;

  const live = (from: ISODate, to: ISODate) =>
    and(eq(expenses.userId, user.id), isNull(expenses.deletedAt), gte(expenses.occurredOn, from), lte(expenses.occurredOn, to));
  const primary = (from: ISODate, to: ISODate) => and(live(from, to), eq(expenses.currency, currency));

  const prevStart = previousPeriodStart(period, start);
  const prev = periodRange(period, prevStart);

  const [
    [head],
    [prevHead],
    byCategoryRows,
    byPayeeRows,
    byDayRows,
    largestRows,
    [fixed],
    otherCurrencyRows,
    [proof],
  ] = await Promise.all([
    db
      .select({
        total: sum,
        count: cnt,
        estimated: sql<number>`count(*) filter (where ${expenses.isEstimated})::int`,
      })
      .from(expenses)
      .where(primary(start, end)),
    db.select({ total: sum, count: cnt }).from(expenses).where(primary(prev.start, prev.end)),
    db
      .select({
        categoryId: expenses.categoryId,
        name: categories.name,
        icon: categories.icon,
        colorHex: categories.colorHex,
        budgetMinor: categories.budgetMinor,
        budgetCurrency: categories.budgetCurrency,
        total: sum,
        count: cnt,
      })
      .from(expenses)
      .leftJoin(categories, eq(categories.id, expenses.categoryId))
      .where(primary(start, end))
      .groupBy(expenses.categoryId, categories.name, categories.icon, categories.colorHex, categories.budgetMinor, categories.budgetCurrency)
      .orderBy(desc(sum)),
    db
      .select({ payee: expenses.payee, total: sum, count: cnt })
      .from(expenses)
      .where(and(primary(start, end), isNotNull(expenses.payee)))
      .groupBy(expenses.payee)
      .orderBy(desc(sum))
      .limit(5),
    db
      .select({ date: expenses.occurredOn, total: sum, count: cnt })
      .from(expenses)
      .where(primary(start, end))
      .groupBy(expenses.occurredOn),
    db
      .select({
        id: expenses.id,
        description: expenses.description,
        amountMinor: expenses.amountMinor,
        occurredOn: expenses.occurredOn,
        categoryName: categories.name,
      })
      .from(expenses)
      .leftJoin(categories, eq(categories.id, expenses.categoryId))
      .where(primary(start, end))
      .orderBy(desc(expenses.amountMinor))
      .limit(3),
    db
      .select({ total: sum })
      .from(expenses)
      .where(and(primary(start, end), isNotNull(expenses.recurringChargeId))),
    db
      .select({ currency: expenses.currency, total: sum, count: cnt })
      .from(expenses)
      .where(and(live(start, end), sql`${expenses.currency} <> ${currency}`))
      .groupBy(expenses.currency),
    db
      .select({
        n: sql<number>`count(distinct ${expenses.id})::int`,
      })
      .from(expenses)
      .innerJoin(attachments, and(eq(attachments.expenseId, expenses.id), isNull(attachments.deletedAt), isNotNull(attachments.uploadedAt)))
      .where(primary(start, end)),
  ]);

  const totalMinor = Number(head?.total ?? 0);
  const prevTotal = Number(prevHead?.total ?? 0);
  const byDayMap = new Map(byDayRows.map((r) => [r.date, { totalMinor: Number(r.total), count: r.count }]));

  return {
    period,
    periodStart: start,
    periodEnd: end,
    currency,
    totalMinor,
    count: head?.count ?? 0,
    estimatedCount: head?.estimated ?? 0,
    withProofCount: proof?.n ?? 0,
    previous: {
      periodStart: prev.start,
      totalMinor: prevTotal,
      count: prevHead?.count ?? 0,
      deltaMinor: totalMinor - prevTotal,
      deltaPct: prevTotal > 0 ? Math.round(((totalMinor - prevTotal) / prevTotal) * 1000) / 10 : null,
    },
    byCategory: byCategoryRows.map((r) => {
      const t = Number(r.total);
      const budget = period === 'month' && r.budgetMinor != null && (r.budgetCurrency ?? currency) === currency ? Number(r.budgetMinor) : null;
      return {
        categoryId: r.categoryId,
        name: r.name ?? 'Uncategorised',
        icon: r.icon ?? null,
        colorHex: r.colorHex ?? null,
        totalMinor: t,
        count: r.count,
        sharePct: totalMinor > 0 ? Math.round((t / totalMinor) * 1000) / 10 : 0,
        budgetMinor: budget,
        budgetPct: budget && budget > 0 ? Math.round((t / budget) * 1000) / 10 : null,
      };
    }),
    byPayee: byPayeeRows.map((r) => ({ payee: r.payee ?? '', totalMinor: Number(r.total), count: r.count })),
    byDay: eachDay(start, end).map((date) => ({ date, ...(byDayMap.get(date) ?? { totalMinor: 0, count: 0 }) })),
    largest: largestRows.map((r) => ({ ...r, amountMinor: Number(r.amountMinor), categoryName: r.categoryName ?? null })),
    fixedMinor: Number(fixed?.total ?? 0),
    variableMinor: totalMinor - Number(fixed?.total ?? 0),
    otherCurrencies: otherCurrencyRows.map((r) => ({ currency: r.currency, totalMinor: Number(r.total), count: r.count })),
  };
}
