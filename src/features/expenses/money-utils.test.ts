import { describe, expect, it } from 'vitest';

import { formatTotals, makeCurrencyLookup, sumByCurrency } from './money-utils';

const lookup = makeCurrencyLookup([
  { code: 'XAF', exponent: 0, symbol: 'FCFA' },
  { code: 'EUR', exponent: 2, symbol: '€' },
]);

describe('sumByCurrency', () => {
  it('keeps currencies apart', () => {
    const totals = sumByCurrency([
      { amountMinor: 5000, currency: 'XAF' },
      { amountMinor: 2500, currency: 'XAF' },
      { amountMinor: 1250, currency: 'EUR' },
    ]);
    expect(totals.get('XAF')).toBe(7500);
    expect(totals.get('EUR')).toBe(1250);
  });
});

describe('formatTotals', () => {
  it('joins per-currency totals', () => {
    const s = formatTotals(new Map([['XAF', 7500], ['EUR', 1250]]), lookup).replace(/\s/g, ' ');
    expect(s).toBe('7 500 FCFA · 12,50 €');
  });
  it('falls back to the code when the currency is unknown', () => {
    expect(formatTotals(new Map([['NGN', 300]]), lookup)).toContain('NGN');
  });
});
