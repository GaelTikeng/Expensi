import type { Import, User } from '../../db/schema';
import { HttpError } from '../../errors';
import { logUsage } from '../../ai/client';
import { assertQuota } from '../../ai/quota';
import type { Repositories } from '../../repositories';
import { getObjectBuffer } from '../../storage/s3';
import { isValidISODate } from '@/src/lib/dates';
import { runExtraction } from './extract';
import { parseSource } from './parse';

const MAX_ATTEMPTS = 3;
/** A `processing` row older than this is considered abandoned and may be retried. */
const STALE_PROCESSING_MS = 2 * 60 * 1000;

/**
 * F3.5–F3.7, F3.13: download → parse → model → staged rows. Idempotent and
 * safe to call again after a dropped connection; re-runs replace the staged
 * items. Never promotes anything to `expenses` (D5).
 */
export async function processImport(repos: Repositories, user: User, imp: Import): Promise<Import> {
  if (imp.status === 'review' || imp.status === 'committed') return imp;
  if (imp.status === 'processing' && Date.now() - imp.updatedAt.getTime() < STALE_PROCESSING_MS) {
    throw new HttpError(409, 'import_in_progress', 'This file is still being processed');
  }
  if (imp.attemptCount >= MAX_ATTEMPTS) {
    throw new HttpError(409, 'import_attempts_exhausted', 'This file failed too many times. Upload it again.');
  }

  await assertQuota(user.id, 'extract'); // 429 before any work or state change

  const attempt = imp.attemptCount + 1;
  await repos.imports.update(imp.id, { status: 'processing', attemptCount: attempt, failureReason: null });

  try {
    const buffer = await getObjectBuffer(imp.storageKey);
    const source = await parseSource(imp.sourceType, buffer);
    const effectiveType = source.kind === 'scan' ? 'pdf_scan' : imp.sourceType;

    const categories = await repos.categories.list();
    const outcome = await runExtraction(source, {
      filename: imp.originalFilename,
      categoryNames: categories.map((c) => c.name),
    });

    await logUsage({ userId: user.id, operation: 'extract', inputTokens: outcome.inputTokens, outputTokens: outcome.outputTokens });

    const currency =
      outcome.result.detected_currency && outcome.result.detected_currency !== 'UNKNOWN'
        ? outcome.result.detected_currency.slice(0, 3).toUpperCase()
        : user.defaultCurrency;
    const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    const rows = outcome.result.lines.map((l, i) => {
      const guess = l.category_guess?.trim() ?? null;
      const categoryId = guess ? (byName.get(guess.toLowerCase()) ?? fuzzyCategory(guess, byName)) : null;
      return {
        id: undefined,
        lineIndex: Number.isFinite(l.line_index) ? l.line_index : i,
        rawText: l.raw_text || l.description || '',
        amountMinor: l.amount_minor != null && l.amount_minor > 0 ? l.amount_minor : null,
        currency,
        occurredOn: l.occurred_on && isValidISODate(l.occurred_on) ? l.occurred_on : null,
        description: l.description?.trim() || null,
        payee: l.payee?.trim() || null,
        categoryGuess: guess,
        categoryId,
        confidence: l.confidence ?? null,
        ambiguityNote: l.ambiguity_note?.trim() || null,
        lineKind: l.line_kind,
        reviewState: 'pending' as const,
      };
    });
    // Guard against duplicate line_index values from a sloppy model.
    const seen = new Set<number>();
    for (const r of rows) {
      while (seen.has(r.lineIndex)) r.lineIndex++;
      seen.add(r.lineIndex);
    }

    await repos.imports.replaceItems(imp.id, rows);
    const updated = await repos.imports.update(imp.id, {
      status: 'review',
      sourceType: effectiveType,
      pageCount: 'pageCount' in source ? source.pageCount : 1,
      model: outcome.model,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      latencyMs: outcome.latencyMs,
      detectedCurrency: outcome.result.detected_currency,
      detectedLanguage: outcome.result.detected_language ?? null,
      documentQuality: outcome.result.document_quality,
    });
    return updated!;
  } catch (err) {
    const reason = friendlyReason(err);
    const updated = await repos.imports.update(imp.id, { status: 'failed', failureReason: reason });
    return updated!;
  }
}

function fuzzyCategory(guess: string, byName: Map<string, string>): string | null {
  const g = guess.toLowerCase();
  for (const [name, id] of byName) {
    if (name.includes(g) || g.includes(name)) return id;
    const first = name.split(/[\s&]+/)[0];
    if (first && first.length > 3 && g.includes(first)) return id;
  }
  return null;
}

function friendlyReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/file|input_file|unsupported|content part/i.test(msg) && /pdf|file/i.test(msg)) {
    return 'This PDF has no selectable text and the AI provider does not accept scanned PDFs yet. Export a text PDF or photograph the pages.';
  }
  if (/context|too long|maximum.*tokens/i.test(msg)) return 'The file is too large for one pass. Split it and try again.';
  return msg.slice(0, 500);
}
