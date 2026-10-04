import { z } from 'zod';

import type { RecapPeriod } from '../dates';
import { isoDateSchema } from './expense';

export const recapQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  /** Any date inside the period; the server normalises it. Defaults to today. */
  start: isoDateSchema.optional(),
  /** "1" to also generate the AI narrative (week/month only). */
  narrative: z.enum(['0', '1']).optional(),
});

/**
 * Deterministic figures computed by SQL (CLAUDE.md D6). All amounts are
 * minor units of `currency` (the user's default); other currencies appear in
 * `otherCurrencies` as plain totals and are excluded from the breakdowns.
 */
export interface RecapStats {
  period: RecapPeriod;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalMinor: number;
  count: number;
  estimatedCount: number;
  withProofCount: number;
  previous: {
    periodStart: string;
    totalMinor: number;
    count: number;
    deltaMinor: number;
    /** null when the previous period had no spend. */
    deltaPct: number | null;
  };
  byCategory: {
    categoryId: string | null;
    name: string;
    icon: string | null;
    colorHex: string | null;
    totalMinor: number;
    count: number;
    sharePct: number;
    /** Monthly budget in the same currency, when set (month period only). */
    budgetMinor: number | null;
    budgetPct: number | null;
  }[];
  byPayee: { payee: string; totalMinor: number; count: number }[];
  byDay: { date: string; totalMinor: number; count: number }[];
  largest: { id: string; description: string; amountMinor: number; occurredOn: string; categoryName: string | null }[];
  /** Spend that came from fixed monthly charges vs everything else (F6.5). */
  fixedMinor: number;
  variableMinor: number;
  otherCurrencies: { currency: string; totalMinor: number; count: number }[];
}

export interface RecapDto {
  period: RecapPeriod;
  periodStart: string;
  generatedAt: string;
  stats: RecapStats;
  narrativeMd: string | null;
  model: string | null;
}

export interface RecapOverview {
  today: RecapStats;
  week: RecapStats;
  month: RecapStats;
}
