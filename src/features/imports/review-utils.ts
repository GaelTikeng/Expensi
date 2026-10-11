import { classifyLine, type ExtractedLine, type ReviewReasonCode, type ReviewSeverity } from '@/src/ai/extraction-contract';
import { t } from '@/src/i18n';
import type { ImportItemDto } from '@/src/lib/schemas/import';

export interface ReviewedItem {
  item: ImportItemDto;
  severity: ReviewSeverity;
  defaultSelected: boolean;
  reason?: string;
}

/** The model's own note wins where it wrote one; otherwise our wording. */
function reasonText(code: ReviewReasonCode | undefined, line: ExtractedLine): string | undefined {
  if (!code) return undefined;
  if ((code === 'amountUnreadable' || code === 'lowConfidence') && line.ambiguityNote) return line.ambiguityNote;
  if (code === 'notExpense') return t('imports.reasons.notExpense', { kind: t(`imports.kindShort.${line.lineKind}`) });
  return t(`imports.reasons.${code}`);
}

/** Runs the shared gating logic over staged rows. Pure; unit-tested. */
export function reviewItems(items: ImportItemDto[]): ReviewedItem[] {
  return items.map((item) => {
    const line: ExtractedLine = {
      lineIndex: item.lineIndex,
      rawText: item.rawText,
      lineKind: item.lineKind,
      amountMinor: item.amountMinor ?? undefined,
      occurredOn: item.occurredOn ?? undefined,
      description: item.description ?? undefined,
      // A user edit is a human confirmation; treat it as full confidence.
      confidence: item.editedByUser ? 1 : (item.confidence ?? undefined),
      ambiguityNote: item.ambiguityNote ?? undefined,
    };
    const r = classifyLine(line);
    // Duplicates are never pre-ticked, whatever the model's confidence.
    const defaultSelected = r.defaultSelected && !item.possibleDuplicateOf;
    const reason = item.possibleDuplicateOf
      ? t('imports.reasons.duplicate', { description: item.possibleDuplicateOf.description })
      : reasonText(r.code, line);
    return { item, severity: item.possibleDuplicateOf && r.severity === 'ok' ? 'verify' : r.severity, defaultSelected, reason };
  });
}

/** Ids that may be committed right now: ticked, expense kind, amount and date present. */
export function committableIds(reviewed: ReviewedItem[], selected: Set<string>): string[] {
  return reviewed
    .filter(({ item }) => selected.has(item.id) && item.lineKind === 'expense' && item.amountMinor != null && item.amountMinor > 0 && item.occurredOn)
    .map(({ item }) => item.id);
}
