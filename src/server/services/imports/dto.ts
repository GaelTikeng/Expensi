import { and, eq, inArray, isNull, notInArray, or } from 'drizzle-orm';

import { reconcileAgainstTotal, type ExtractedLine } from '@/src/ai/extraction-contract';
import type { Db } from '../../db/client';
import { expenses, type Import, type ImportItem } from '../../db/schema';
import type { DuplicateCandidate, ImportDetailResponse, ImportDto, ImportItemDto } from '@/src/lib/schemas/import';

export function importToDto(i: Import & { itemCount?: number }): ImportDto {
  return {
    id: i.id,
    sourceType: i.sourceType,
    originalFilename: i.originalFilename,
    mimeType: i.mimeType,
    sizeBytes: i.sizeBytes,
    pageCount: i.pageCount,
    status: i.status,
    failureReason: i.failureReason,
    attemptCount: i.attemptCount,
    model: i.model,
    inputTokens: i.inputTokens,
    outputTokens: i.outputTokens,
    latencyMs: i.latencyMs,
    detectedCurrency: i.detectedCurrency,
    detectedLanguage: i.detectedLanguage,
    documentQuality: i.documentQuality,
    committedAt: i.committedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    ...(i.itemCount !== undefined ? { itemCount: i.itemCount } : {}),
  };
}

/**
 * F3.9 duplicate detection: an existing live expense with the same amount on
 * the same day is a likely duplicate. Computed, never stored, so it stays
 * accurate as the ledger changes. Expenses created from this very import are
 * excluded, otherwise every committed line would match itself.
 */
async function findDuplicates(db: Db, userId: string, items: ImportItem[]): Promise<Map<string, DuplicateCandidate>> {
  const candidates = items.filter((i) => i.amountMinor != null && i.occurredOn);
  if (candidates.length === 0) return new Map();
  const pairs = candidates.map((i) => and(eq(expenses.amountMinor, i.amountMinor!), eq(expenses.occurredOn, i.occurredOn!)));
  const rows = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      amountMinor: expenses.amountMinor,
      currency: expenses.currency,
      occurredOn: expenses.occurredOn,
      payee: expenses.payee,
      categoryId: expenses.categoryId,
      source: expenses.source,
      importItemId: expenses.importItemId,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        isNull(expenses.deletedAt),
        or(isNull(expenses.importItemId), notInArray(expenses.importItemId, items.map((i) => i.id))),
        or(...pairs),
      ),
    );
  const byKey = new Map<string, DuplicateCandidate>();
  for (const r of rows) {
    const key = `${r.amountMinor}|${r.occurredOn}`;
    if (!byKey.has(key)) byKey.set(key, { id: r.id, description: r.description, amountMinor: r.amountMinor, currency: r.currency, occurredOn: r.occurredOn, payee: r.payee, categoryId: r.categoryId, source: r.source });
  }
  const out = new Map<string, DuplicateCandidate>();
  for (const i of candidates) {
    const hit = byKey.get(`${i.amountMinor}|${i.occurredOn}`);
    if (hit) out.set(i.id, hit);
  }
  return out;
}

/** Which expense each committed line became (empty before commit). */
async function findCreatedExpenses(db: Db, userId: string, items: ImportItem[]): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();
  const rows = await db
    .select({ id: expenses.id, importItemId: expenses.importItemId })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), isNull(expenses.deletedAt), inArray(expenses.importItemId, items.map((i) => i.id))));
  return new Map(rows.filter((r) => r.importItemId).map((r) => [r.importItemId!, r.id]));
}

export async function buildDetail(db: Db, userId: string, imp: Import, items: ImportItem[]): Promise<ImportDetailResponse> {
  const [dupes, created] = await Promise.all([findDuplicates(db, userId, items), findCreatedExpenses(db, userId, items)]);
  const itemDtos: ImportItemDto[] = items.map((i) => ({
    id: i.id,
    importId: i.importId,
    lineIndex: i.lineIndex,
    rawText: i.rawText,
    amountMinor: i.amountMinor,
    currency: i.currency,
    occurredOn: i.occurredOn,
    description: i.description,
    payee: i.payee,
    categoryGuess: i.categoryGuess,
    categoryId: i.categoryId,
    confidence: i.confidence,
    ambiguityNote: i.ambiguityNote,
    lineKind: i.lineKind,
    reviewState: i.reviewState,
    editedByUser: i.editedByUser,
    possibleDuplicateOf: dupes.get(i.id) ?? null,
    expenseId: created.get(i.id) ?? null,
  }));

  const asLines: ExtractedLine[] = items.map((i) => ({
    line_index: i.lineIndex,
    raw_text: i.rawText,
    line_kind: i.lineKind,
    amount_minor: i.amountMinor ?? undefined,
  }));

  return { import: importToDto(imp), items: itemDtos, reconciliation: reconcileAgainstTotal(asLines) };
}

