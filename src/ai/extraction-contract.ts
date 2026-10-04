/**
 * The extraction contract.
 *
 * Everything the model is allowed to return is defined here. The app never
 * parses prose — it reads a tool call whose arguments match this schema.
 *
 * This file is CLIENT-SAFE: it holds types, the tool schema, the prompt and
 * the pure review-gating functions. It is imported by both the app (review
 * screen) and the API routes (extraction). It must never import from
 * src/server. Model ids live in src/server/ai/client.ts.
 */

import { z } from 'zod';

/* ── the tool (OpenAI function-calling shape) ────────────────────────────── */
/**
 * Forced via tool_choice: { type: 'function', function: { name: 'record_expense_lines' } }.
 * That guarantees structured arguments and removes "here is the JSON you asked
 * for" preambles entirely.
 */
export const RECORD_EXPENSE_LINES_TOOL = {
  type: 'function',
  function: {
  name: 'record_expense_lines',
  description:
    'Record every line item transcribed from an image or PDF of an expense ' +
    'list. Call exactly once, after reading the entire document.',
  parameters: {
    type: 'object',
    properties: {
      detected_currency: {
        type: 'string',
        description:
          'ISO-4217 code inferred from symbols, words, or plausible magnitudes ' +
          '(e.g. "FCFA"/"F"/"XAF" -> XAF). Use "UNKNOWN" if genuinely unclear.',
      },
      detected_language: { type: 'string', description: 'BCP-47, e.g. "fr".' },
      document_quality: {
        type: 'string',
        enum: ['good', 'usable', 'poor'],
        description: '"poor" means the user should be prompted to re-shoot.',
      },
      lines: {
        type: 'array',
        description:
          'One entry per visible line, IN DOCUMENT ORDER, including lines that ' +
          'are not expenses. Never silently skip a line.',
        items: {
          type: 'object',
          properties: {
            line_index: { type: 'integer', description: '0-based, top to bottom.' },
            raw_text: {
              type: 'string',
              description:
                'Verbatim transcription of the line exactly as written, ' +
                'including original number formatting. Do not normalise here.',
            },
            line_kind: {
              type: 'string',
              enum: [
                'expense',
                'total',
                'subtotal',
                'header',
                'struck_through',
                'illegible',
              ],
              description:
                'CRITICAL: a summed total or subtotal is NOT an expense. ' +
                'A line crossed out by the writer is "struck_through" and must ' +
                'not be counted.',
            },
            amount_minor: {
              type: 'integer',
              description:
                'Amount in MINOR UNITS of detected_currency. For zero-decimal ' +
                'currencies such as XAF, minor units equal whole units: ' +
                '"5.000 F" -> 5000. For two-decimal currencies, "12,50 €" -> ' +
                '1250. Omit if not legible.',
            },
            occurred_on: {
              type: 'string',
              description:
                'YYYY-MM-DD. Only if a date is written on or above this line. ' +
                'Never invent or infer today. Omit a year that is not written.',
            },
            description: {
              type: 'string',
              description: 'Cleaned-up label for what was purchased.',
            },
            payee: { type: 'string', description: 'Who was paid, if written.' },
            category_guess: { type: 'string' },
            confidence: {
              type: 'number',
              description:
                '0..1 for the AMOUNT specifically. Be pessimistic: <=0.7 for ' +
                'any digit you would not bet money on.',
            },
            ambiguity_note: {
              type: 'string',
              description:
                'Plain-language note when uncertain, e.g. "second digit is ' +
                'either 3 or 8". Shown verbatim to the user.',
            },
          },
          required: ['line_index', 'raw_text', 'line_kind'],
        },
      },
    },
    required: ['detected_currency', 'document_quality', 'lines'],
  },
  },
} as const;

/* ── system prompt ───────────────────────────────────────────────────────── */
export const EXTRACTION_SYSTEM_PROMPT = `
You transcribe handwritten and printed expense lists into structured line items.
You are a transcriber, not an accountant: report what is written, flag what is
unclear, and never improve on the source.

NUMBER FORMATTING
- Assume French/Central African conventions unless the document clearly shows
  otherwise: "." and thin spaces are THOUSANDS separators, "," is the decimal
  separator. "5.000" is five thousand, not five. "1 250" is one thousand
  two hundred fifty.
- XAF (FCFA) has no subunit. Never emit a fractional XAF amount. Amounts are
  almost always round multiples of 5 or 25 — an amount like 5003 XAF is a signal
  you misread a digit, so lower confidence rather than reporting it confidently.
- Strip currency symbols from amount_minor; record them in raw_text.

DATES
- Written numeric dates are DD/MM, not MM/DD.
- If no year is written, omit occurred_on rather than guessing. The app will ask.
- A date written once at the top of a list applies to the lines beneath it;
  propagate it, but only downward until a new date appears.

WHAT IS NOT AN EXPENSE
- Totals, subtotals, "TOTAL", "Somme", running balances, and carried-forward
  figures. Mark them 'total'/'subtotal'. Including them double-counts the list.
- Column headers, page numbers, names, phone numbers.
- Lines the writer crossed out: 'struck_through'.
Still emit these lines with their raw_text so the user sees nothing was dropped.

UNCERTAINTY
- Never guess an amount to appear complete. An omitted amount with an
  ambiguity_note is far more useful than a confident wrong number, because the
  user will correct the former and trust the latter.
- Handwritten 1/7, 3/8, 4/9, 0/6 confusions are common. Say so explicitly.
- If the image is blurry, cropped, or badly lit, set document_quality to 'poor'.

Read the whole document first, then call record_expense_lines exactly once.
`.trim();

/* ── tabular addendum ────────────────────────────────────────────────────── */
/**
 * Appended to the system prompt when the source is a spreadsheet or CSV that
 * has already been parsed into rows. The model maps columns, it does not OCR.
 */
export const TABULAR_PROMPT_ADDENDUM = `
SOURCE FORMAT
- You receive a table as tab-separated rows, first row(s) may be headers.
- Decide which columns hold the date, the amount, the description/label, and
  (optionally) the payee and category. Header names may be French or English
  (Date, Montant, Libellé, Désignation, Bénéficiaire, Catégorie…).
- Emit exactly one line per DATA row, in order; raw_text is the row joined
  with " | ". Mark header rows 'header' and total rows 'total'.
- Amounts may use spreadsheet number formatting; apply the same locale rules.
- If a row has a debit and a credit column, only debits are expenses; a credit
  row is 'header' with an ambiguity_note saying it is income.
`.trim();

/** Appended when the user's categories are known so guesses match them. */
export function categoriesPromptAddendum(names: string[]): string {
  if (names.length === 0) return '';
  return `\nCATEGORIES\nFor category_guess, pick the closest of: ${names.join(', ')}. Leave it out if none fits.`;
}

/* ── typed output ────────────────────────────────────────────────────────── */
export type LineKind =
  | 'expense'
  | 'total'
  | 'subtotal'
  | 'header'
  | 'struck_through'
  | 'illegible';

export interface ExtractedLine {
  line_index: number;
  raw_text: string;
  line_kind: LineKind;
  amount_minor?: number;
  occurred_on?: string;
  description?: string;
  payee?: string;
  category_guess?: string;
  confidence?: number;
  ambiguity_note?: string;
}

export interface ExtractionResult {
  detected_currency: string;
  detected_language?: string;
  document_quality: 'good' | 'usable' | 'poor';
  lines: ExtractedLine[];
}

/**
 * Runtime validation of what the model returned. Lenient where the model is
 * sloppy (string numbers, nulls) so one odd field does not fail a whole file.
 */
export const extractionResultSchema = z.object({
  detected_currency: z.string().trim().min(1).max(8).default('UNKNOWN'),
  detected_language: z.string().trim().max(16).optional().nullable(),
  document_quality: z.enum(['good', 'usable', 'poor']).catch('usable'),
  lines: z
    .array(
      z.object({
        line_index: z.coerce.number().int().min(0),
        raw_text: z.string().default(''),
        line_kind: z
          .enum(['expense', 'total', 'subtotal', 'header', 'struck_through', 'illegible'])
          .catch('illegible'),
        amount_minor: z.coerce.number().int().optional().nullable(),
        occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().catch(null),
        description: z.string().max(500).optional().nullable(),
        payee: z.string().max(200).optional().nullable(),
        category_guess: z.string().max(120).optional().nullable(),
        confidence: z.coerce.number().min(0).max(1).optional().nullable().catch(null),
        ambiguity_note: z.string().max(1000).optional().nullable(),
      }),
    )
    .default([]),
});
export type ValidatedExtraction = z.infer<typeof extractionResultSchema>;

/* ── review gating ───────────────────────────────────────────────────────── */
/** Below this, the amount field opens focused and empty-highlighted for retype. */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.85;

export type ReviewSeverity = 'ok' | 'verify' | 'blocked';

/**
 * Decides how each line is presented on the review screen. Pure function, no
 * model involved — this is the safety net between extraction and the ledger.
 */
export function classifyLine(line: ExtractedLine): {
  severity: ReviewSeverity;
  /** Pre-ticked for commit. Only ever true for clean expense lines. */
  defaultSelected: boolean;
  reason?: string;
} {
  if (line.line_kind !== 'expense') {
    return {
      severity: 'blocked',
      defaultSelected: false,
      reason: `Not an expense (${line.line_kind.replace('_', ' ')})`,
    };
  }
  if (line.amount_minor == null) {
    return {
      severity: 'blocked',
      defaultSelected: false,
      reason: line.ambiguity_note ?? 'Amount could not be read',
    };
  }
  if (line.amount_minor <= 0) {
    return { severity: 'blocked', defaultSelected: false, reason: 'Invalid amount' };
  }
  if ((line.confidence ?? 0) < CONFIDENCE_REVIEW_THRESHOLD) {
    return {
      severity: 'verify',
      defaultSelected: false,
      reason: line.ambiguity_note ?? 'Low confidence — please check the amount',
    };
  }
  if (!line.occurred_on) {
    return {
      severity: 'verify',
      defaultSelected: true,
      reason: 'No date written — confirm the date',
    };
  }
  return { severity: 'ok', defaultSelected: true };
}

/**
 * Cross-check: if the document contained a total, compare it against the sum of
 * accepted expense lines. A mismatch is the single strongest signal that a digit
 * was misread, and it costs nothing to compute.
 */
export function reconcileAgainstTotal(lines: ExtractedLine[]): {
  statedTotalMinor: number | null;
  computedTotalMinor: number;
  discrepancyMinor: number | null;
} {
  const stated = lines.find(
    (l) => l.line_kind === 'total' && l.amount_minor != null,
  );
  const computed = lines
    .filter((l) => l.line_kind === 'expense' && l.amount_minor != null)
    .reduce((sum, l) => sum + l.amount_minor!, 0);

  return {
    statedTotalMinor: stated?.amount_minor ?? null,
    computedTotalMinor: computed,
    discrepancyMinor:
      stated?.amount_minor != null ? stated.amount_minor - computed : null,
  };
}
