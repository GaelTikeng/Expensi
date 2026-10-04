import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

import { db } from '../db/client';
import { aiUsage } from '../db/schema';
import { env } from '../env';

/**
 * All model calls go through this one instance: the official OpenAI SDK
 * pointed at TensorX's OpenAI-compatible endpoint (CLAUDE.md D11).
 */
export const ai = new OpenAI({
  apiKey: env.TENSORX_API_KEY,
  baseURL: env.TENSORX_BASE_URL,
});

/**
 * The single place model ids live. Defaults are overridable via env so a
 * model swap is a config change. Verify ids with `GET /v1/models` (F3.3).
 */
export const MODELS = {
  /** Multimodal: spreadsheet/PDF line extraction, scanned pages. */
  extract: env.TENSORX_MODEL_EXTRACT,
  /** Text-only: recap narrative over SQL-computed stats. */
  narrative: env.TENSORX_MODEL_NARRATIVE,
} as const;

export type AiOperation = 'extract' | 'narrative';

/** First day of the current month, YYYY-MM-DD, in UTC. */
function currentPeriodStart(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Records one call against the user's monthly quota ledger. Upsert so the
 * first call of the month creates the row and later calls increment it.
 */
export async function logUsage(input: {
  userId: string;
  operation: AiOperation;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): Promise<void> {
  const inTok = input.inputTokens ?? 0;
  const outTok = input.outputTokens ?? 0;
  await db
    .insert(aiUsage)
    .values({
      userId: input.userId,
      periodStart: currentPeriodStart(),
      operation: input.operation,
      callCount: 1,
      inputTokens: inTok,
      outputTokens: outTok,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.periodStart, aiUsage.operation],
      set: {
        callCount: sql`${aiUsage.callCount} + 1`,
        inputTokens: sql`${aiUsage.inputTokens} + ${inTok}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${outTok}`,
      },
    });
}

/** Lists the model ids the key can use. Handy for F3.3 verification. */
export async function listModels(): Promise<string[]> {
  const page = await ai.models.list();
  return page.data.map((m) => m.id).sort();
}
