import { ai, logUsage, MODELS } from '../../ai/client';
import type { User } from '../../db/schema';
import type { RecapStats } from '@/src/lib/schemas/recap';

const SYSTEM = `
You write a short, plain-language spending recap for a personal expense app.
You are given precomputed figures as JSON. Rules:
- Use ONLY numbers that appear in the JSON. Never add, subtract, average or
  estimate anything yourself. If a figure is not there, do not mention it.
- Amounts are integers in MINOR units of the given currency. XAF has no
  decimals, so 5000 means 5 000 FCFA. EUR/USD have 2 decimals, so 1250 means
  12,50. Format amounts the way a French speaker would (space thousands).
- 3 to 5 sentences, friendly and neutral, second person ("you"). No headings,
  no bullet points, no emojis, no advice to invest.
- Mention: the total and how it compares to the previous period; the biggest
  category; any category over its budget (budgetPct > 100); one notable
  payee or largest expense if present. Say if many lines are estimates.
- Write in English.
`.trim();

export const NARRATIVE_MAX_TOKENS = 2000;

export interface NarrativeOutcome {
  text: string;
  model: string;
}

/** F4.3: prose over figures it cannot change (CLAUDE.md D6). */
export async function generateNarrative(user: User, stats: RecapStats): Promise<NarrativeOutcome | null> {
  if (stats.count === 0) return null;

  const completion = await ai.chat.completions.create({
    model: MODELS.narrative,
    temperature: 0.4,
    // TensorX models reason before answering and reasoning tokens count
    // against max_tokens. A real recap prompt needs ~700 reasoning + ~100
    // text tokens; 400 left nothing for the answer (measured 2026-10-04).
    max_tokens: NARRATIVE_MAX_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Period: ${stats.period} starting ${stats.periodStart} (${stats.periodStart} to ${stats.periodEnd}). Figures:\n${JSON.stringify(trim(stats))}`,
      },
    ],
  });

  await logUsage({
    userId: user.id,
    operation: 'narrative',
    inputTokens: completion.usage?.prompt_tokens ?? null,
    outputTokens: completion.usage?.completion_tokens ?? null,
  });

  const choice = completion.choices[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    // Throw rather than return null so the caller keeps no empty narrative
    // and the next request tries again.
    if (choice?.finish_reason === 'length') {
      throw new Error(`narrative cut off: token budget (${NARRATIVE_MAX_TOKENS}) spent before any text`);
    }
    return null;
  }
  return { text, model: completion.model ?? MODELS.narrative };
}

/** Keeps the prompt small: drop per-day zeros and long tails. */
function trim(s: RecapStats) {
  return {
    currency: s.currency,
    totalMinor: s.totalMinor,
    count: s.count,
    estimatedCount: s.estimatedCount,
    previous: s.previous,
    byCategory: s.byCategory.slice(0, 6),
    byPayee: s.byPayee.slice(0, 3),
    largest: s.largest.slice(0, 2),
    fixedMinor: s.fixedMinor,
    variableMinor: s.variableMinor,
    otherCurrencies: s.otherCurrencies,
  };
}
