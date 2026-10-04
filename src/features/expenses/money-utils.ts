import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { ExpenseDto } from '@/src/lib/schemas/expense';

export type CurrencyLookup = (code: string) => CurrencyInfo;

/** Falls back to a zero-decimal rendering when reference data is not loaded yet. */
export function makeCurrencyLookup(list: CurrencyInfo[]): CurrencyLookup {
  const map = new Map(list.map((c) => [c.code, c]));
  return (code) => map.get(code) ?? { code, exponent: 0, symbol: code };
}

/** Sums per currency, since a month can mix XAF and EUR. */
export function sumByCurrency(items: Pick<ExpenseDto, 'amountMinor' | 'currency'>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of items) out.set(e.currency, (out.get(e.currency) ?? 0) + e.amountMinor);
  return out;
}

/** "5 000 FCFA · 12,50 €" */
export function formatTotals(totals: Map<string, number>, lookup: CurrencyLookup): string {
  return [...totals.entries()].map(([code, minor]) => formatMoney(minor, lookup(code))).join(' · ');
}
