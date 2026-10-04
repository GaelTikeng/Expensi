import { and, eq, isNull, or } from 'drizzle-orm';

import { reconcileAgainstTotal, type ExtractedLine } from '@/src/ai/extraction-contract';
import type { Db } from '../../db/client';
import { expenses, type Import, type ImportItem } from '../../db/schema';
import type { ImportDetailResponse, ImportDto, ImportItemDto } from '@/src/lib/schemas/import';

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
 * accurate as the ledger changes.
 */
async function findDuplicates(db: Db, userId: string, items: ImportItem[]): Promise<Map<string, { id: string; description: string }>> {
  const candidates = items.filter((i) => i.amountMinor != null && i.occurredOn);
  if (candidates.length === 0) return new Map();
  const pairs = candidates.map((i) => and(eq(expenses.amountMinor, i.amountMinor!), eq(expenses.occurredOn, i.occurredOn!)));
  const rows = await db
    .select({ id: expenses.id, description: expenses.description, amountMinor: expenses.amountMinor, occurredOn: expenses.occurredOn })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), isNull(expenses.deletedAt), or(...pairs)));
  const byKey = new Map(rows.map((r) => [`${r.amountMinor}|${r.occurredOn}`, { id: r.id, description: r.description }]));
  const out = new Map<string, { id: string; description: string }>();
  for (const i of candidates) {
    const hit = byKey.get(`${i.amountMinor}|${i.occurredOn}`);
    if (hit) out.set(i.id, hit);
  }
  return out;
}

export async function buildDetail(db: Db, userId: string, imp: Import, items: ImportItem[]): Promise<ImportDetailResponse> {
  const dupes = await findDuplicates(db, userId, items);
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
  }));

  const asLines: ExtractedLine[] = items.map((i) => ({
    line_index: i.lineIndex,
    raw_text: i.rawText,
    line_kind: i.lineKind,
    amount_minor: i.amountMinor ?? undefined,
  }));

  return { import: importToDto(imp), items: itemDtos, reconciliation: reconcileAgainstTotal(asLines) };
}

