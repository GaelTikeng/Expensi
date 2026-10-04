import { and, eq } from 'drizzle-orm';

import { db } from '../db/client';
import { aiUsage } from '../db/schema';
import { env } from '../env';
import { HttpError } from '../errors';
import type { AiOperation } from './client';

export interface QuotaStatus {
  operation: AiOperation;
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
}

function currentPeriodStart(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function limitFor(operation: AiOperation): number {
  return operation === 'extract' ? env.AI_QUOTA_EXTRACT_PER_MONTH : env.AI_QUOTA_NARRATIVE_PER_MONTH;
}

/** F7.6: this month's usage against the configured limit. */
export async function quotaStatus(userId: string, operation: AiOperation): Promise<QuotaStatus> {
  const periodStart = currentPeriodStart();
  const [row] = await db
    .select({ n: aiUsage.callCount })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.periodStart, periodStart), eq(aiUsage.operation, operation)))
    .limit(1);
  const used = row?.n ?? 0;
  const limit = limitFor(operation);
  return { operation, used, limit, remaining: Math.max(0, limit - used), periodStart };
}

/** Throws 429 when the user has no calls left this month. */
export async function assertQuota(userId: string, operation: AiOperation): Promise<QuotaStatus> {
  const status = await quotaStatus(userId, operation);
  if (status.remaining <= 0) {
    throw new HttpError(429, 'quota_exceeded', `You have used all ${status.limit} AI ${operation} runs for this month.`, status);
  }
  return status;
}
