import { and, eq, or } from 'drizzle-orm';

import { recaps, type Recap } from '../db/schema';
import { startOfMonth, startOfWeek, type ISODate, type RecapPeriod } from '@/src/lib/dates';
import { UserScopedRepository } from './base';

export class RecapsRepository extends UserScopedRepository {
  async find(period: RecapPeriod, periodStart: ISODate): Promise<Recap | undefined> {
    const [row] = await this.db
      .select()
      .from(recaps)
      .where(and(eq(recaps.userId, this.userId), eq(recaps.period, period), eq(recaps.periodStart, periodStart)))
      .limit(1);
    return row;
  }

  /** Cache write. Replaces stats; keeps the narrative unless a new one is given. */
  async upsert(input: {
    period: RecapPeriod;
    periodStart: ISODate;
    stats: unknown;
    narrativeMd?: string | null;
    model?: string | null;
  }): Promise<Recap> {
    const [row] = await this.db
      .insert(recaps)
      .values({
        userId: this.userId,
        period: input.period,
        periodStart: input.periodStart,
        stats: input.stats,
        narrativeMd: input.narrativeMd ?? null,
        model: input.model ?? null,
        isStale: false,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [recaps.userId, recaps.period, recaps.periodStart],
        set: {
          stats: input.stats,
          ...(input.narrativeMd !== undefined ? { narrativeMd: input.narrativeMd, model: input.model ?? null } : {}),
          isStale: false,
          generatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async markNotified(id: string): Promise<void> {
    await this.db.update(recaps).set({ notifiedAt: new Date() }).where(and(eq(recaps.userId, this.userId), eq(recaps.id, id)));
  }

  /**
   * F2.8: any expense change on `dates` invalidates the day, week and month
   * recaps that cover them. Harmless when no recap exists yet.
   */
  async markStaleFor(dates: ISODate[]): Promise<number> {
    const pairs = new Map<string, { period: RecapPeriod; start: ISODate }>();
    for (const d of dates) {
      pairs.set(`day:${d}`, { period: 'day', start: d });
      const w = startOfWeek(d);
      pairs.set(`week:${w}`, { period: 'week', start: w });
      const m = startOfMonth(d);
      pairs.set(`month:${m}`, { period: 'month', start: m });
    }
    if (pairs.size === 0) return 0;

    const rows = await this.db
      .update(recaps)
      .set({ isStale: true })
      .where(
        and(
          eq(recaps.userId, this.userId),
          eq(recaps.isStale, false),
          or(...[...pairs.values()].map((p) => and(eq(recaps.period, p.period), eq(recaps.periodStart, p.start)))),
        ),
      )
      .returning({ id: recaps.id });
    return rows.length;
  }
}
