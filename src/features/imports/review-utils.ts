import { classifyLine, type ExtractedLine, type ReviewSeverity } from '@/src/ai/extraction-contract';
import type { ImportItemDto } from '@/src/lib/schemas/import';

export interface ReviewedItem {
  item: ImportItemDto;
  severity: ReviewSeverity;
  defaultSelected: boolean;
  reason?: string;
}

/** Runs the shared gating logic over staged rows. Pure; unit-tested. */
export function reviewItems(items: ImportItemDto[]): ReviewedItem[] {
  return items.map((item) => {
    const line: ExtractedLine = {
      line_index: item.lineIndex,
      raw_text: item.rawText,
      line_kind: item.lineKind,
      amount_minor: item.amountMinor ?? undefined,
      occurred_on: item.occurredOn ?? undefined,
      description: item.description ?? undefined,
      // A user edit is a human confirmation; treat it as full confidence.
      confidence: item.editedByUser ? 1 : (item.confidence ?? undefined),
      ambiguity_note: item.ambiguityNote ?? undefined,
    };
    const r = classifyLine(line);
    // Duplicates are never pre-ticked, whatever the model's confidence.
    const defaultSelected = r.defaultSelected && !item.possibleDuplicateOf;
    const reason = item.possibleDuplicateOf
      ? `Looks like a duplicate of "${item.possibleDuplicateOf.description}"`
      : r.reason;
    return { item, severity: item.possibleDuplicateOf && r.severity === 'ok' ? 'verify' : r.severity, defaultSelected, reason };
  });
}

/** Ids that may be committed right now: ticked, expense kind, amount and date present. */
export function committableIds(reviewed: ReviewedItem[], selected: Set<string>): string[] {
  return reviewed
    .filter(({ item }) => selected.has(item.id) && item.lineKind === 'expense' && item.amountMinor != null && item.amountMinor > 0 && item.occurredOn)
    .map(({ item }) => item.id);
}
