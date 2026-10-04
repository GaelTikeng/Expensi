import { and, eq, or } from 'drizzle-orm';

import { recaps } from '../db/schema';
import { startOfMonth, startOfWeek, type ISODate } from '@/src/lib/dates';
import { UserScopedRepository } from './base';

type Period = 'day' | 'week' | 'month';

export class RecapsRepository extends UserScopedRepository {
  /**
   * F2.8: any expense change on `dates` invalidates the day, week and month
   * recaps that cover them. Harmless when no recap exists yet.
   */
  async markStaleFor(dates: ISODate[]): Promise<number> {
    const pairs = new Map<string, { period: Period; start: ISODate }>();
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
