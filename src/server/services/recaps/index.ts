import type { Db } from '../../db/client';
import type { Recap, User } from '../../db/schema';
import type { Repositories } from '../../repositories';
import { periodStart, type ISODate, type RecapPeriod } from '@/src/lib/dates';
import type { RecapDto, RecapStats } from '@/src/lib/schemas/recap';
import { quotaStatus } from '../../ai/quota';
import { generateNarrative } from './narrative';
import { computeRecapStats } from './stats';

export function recapToDto(r: Recap): RecapDto {
  return {
    period: r.period,
    periodStart: r.periodStart,
    generatedAt: r.generatedAt.toISOString(),
    stats: r.stats as RecapStats,
    narrativeMd: r.narrativeMd,
    model: r.model,
  };
}

/**
 * F4.2 + F4.7: serve from `recaps` when fresh; recompute stats when missing
 * or stale; generate the narrative only when asked for and not already
 * present for the current stats. A narrative failure never fails the recap.
 */
export async function getOrBuildRecap(
  db: Db,
  repos: Repositories,
  user: User,
  period: RecapPeriod,
  anyDate: ISODate,
  wantNarrative: boolean,
): Promise<RecapDto> {
  const start = periodStart(period, anyDate);
  const cached = await repos.recaps.find(period, start);

  const statsFresh = cached && !cached.isStale;
  const narrativeNeeded = wantNarrative && period !== 'day';
  const narrativeFresh = statsFresh && cached?.narrativeMd != null;

  if (statsFresh && (!narrativeNeeded || narrativeFresh)) return recapToDto(cached!);

  const stats = statsFresh ? (cached!.stats as RecapStats) : await computeRecapStats(db, user, period, start);

  let narrativeMd: string | null | undefined;
  let model: string | null | undefined;
  if (narrativeNeeded) {
    try {
      const quota = await quotaStatus(user.id, 'narrative');
      if (quota.remaining <= 0) throw new Error(`narrative quota exhausted (${quota.used}/${quota.limit})`);
      const n = await generateNarrative(user, stats);
      narrativeMd = n?.text ?? null;
      model = n?.model ?? null;
    } catch (err) {
      console.warn('[recaps] narrative failed', err);
      narrativeMd = cached?.narrativeMd ?? null;
      model = cached?.model ?? null;
    }
  } else if (!statsFresh) {
    // Stats changed, so any old prose is now wrong. Clear it.
    narrativeMd = null;
    model = null;
  }

  const row = await repos.recaps.upsert({ period, periodStart: start, stats, narrativeMd, model });
  return recapToDto(row);
}
