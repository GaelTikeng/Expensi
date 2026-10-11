import { currencyInfo } from '@/src/lib/currencies';
import { formatMoney } from '@/src/lib/money';
import { i18n, type Language } from '@/src/i18n';

/** The subset of an expense row the exporters need; structural so tests can build it by hand. */
export interface ExportableExpense {
  occurredOn: string;
  description: string;
  payee: string | null;
  categoryId: string | null;
  amountMinor: number;
  currency: string;
  isEstimated: boolean;
  attachmentCount: number;
  source: string;
}

export interface ExportRow {
  date: string;
  description: string;
  payee: string | null;
  category: string | null;
  amountMinor: number;
  currency: string;
  estimated: boolean;
  proofs: number;
  source: string;
}

export interface ExportTotal {
  currency: string;
  totalMinor: number;
  count: number;
}

export interface ExportCategoryTotal extends ExportTotal {
  category: string;
}

export interface ExportDataset {
  language: Language;
  from: string;
  to: string;
  owner: string;
  generatedAt: Date;
  rows: ExportRow[];
  byCurrency: ExportTotal[];
  /** Per category within each currency, largest first. */
  byCategory: ExportCategoryTotal[];
}

/**
 * E10 F10.1: turns raw rows into what both the spreadsheet and the PDF print.
 * Pure, so the totals are unit-tested once and shared by both formats.
 */
export function buildDataset(input: {
  from: string;
  to: string;
  owner: string;
  expenses: ExportableExpense[];
  categories: { id: string; name: string }[];
  now?: Date;
  language?: Language;
}): ExportDataset {
  const language = input.language ?? 'en';
  const uncategorised = i18n.getFixedT(language)('exportFile.uncategorised');
  const names = new Map(input.categories.map((c) => [c.id, c.name]));
  const rows: ExportRow[] = input.expenses.map((e) => ({
    date: e.occurredOn,
    description: e.description,
    payee: e.payee,
    category: e.categoryId ? (names.get(e.categoryId) ?? null) : null,
    amountMinor: e.amountMinor,
    currency: e.currency,
    estimated: e.isEstimated,
    proofs: e.attachmentCount,
    source: e.source,
  }));

  const byCurrency = new Map<string, ExportTotal>();
  const byCategory = new Map<string, ExportCategoryTotal>();
  for (const r of rows) {
    const cur = byCurrency.get(r.currency) ?? { currency: r.currency, totalMinor: 0, count: 0 };
    cur.totalMinor += r.amountMinor;
    cur.count += 1;
    byCurrency.set(r.currency, cur);

    const category = r.category ?? uncategorised;
    const key = `${r.currency}|${category}`;
    const cat = byCategory.get(key) ?? { currency: r.currency, category, totalMinor: 0, count: 0 };
    cat.totalMinor += r.amountMinor;
    cat.count += 1;
    byCategory.set(key, cat);
  }

  const currencyOrder = [...byCurrency.values()].sort((a, b) => b.count - a.count).map((c) => c.currency);
  return {
    language,
    from: input.from,
    to: input.to,
    owner: input.owner,
    generatedAt: input.now ?? new Date(),
    rows,
    byCurrency: currencyOrder.map((c) => byCurrency.get(c)!),
    byCategory: [...byCategory.values()].sort(
      (a, b) => currencyOrder.indexOf(a.currency) - currencyOrder.indexOf(b.currency) || b.totalMinor - a.totalMinor,
    ),
  };
}

/** "5 000 FCFA", with the symbol the app uses elsewhere. */
export function money(amountMinor: number, currency: string): string {
  return formatMoney(amountMinor, currencyInfo(currency));
}

/** Major units as a number, for spreadsheet cells. */
export function major(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyInfo(currency).exponent;
}
