import { describe, expect, it } from 'vitest';

import { formatMoney, parseLocaleAmount, toMinor } from './money';

const XAF = { code: 'XAF', exponent: 0, symbol: 'FCFA' };
const EUR = { code: 'EUR', exponent: 2, symbol: '€' };

describe('parseLocaleAmount', () => {
  it('treats dots and spaces as thousands separators on XAF', () => {
    expect(parseLocaleAmount('5.000', 0)).toBe(5000);
    expect(parseLocaleAmount('5 000', 0)).toBe(5000);
    expect(parseLocaleAmount('1.250.000 F', 0)).toBe(1_250_000);
  });

  it('treats comma as the decimal separator', () => {
    expect(parseLocaleAmount('12,50', 2)).toBe(1250);
    expect(parseLocaleAmount('1.250,75', 2)).toBe(125_075);
  });

  it('accepts a dot as decimal when it fits the exponent', () => {
    expect(parseLocaleAmount('12.50', 2)).toBe(1250);
  });

  it('rejects non-numbers', () => {
    expect(parseLocaleAmount('', 0)).toBeNull();
    expect(parseLocaleAmount('abc', 0)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats XAF without decimals', () => {
    expect(formatMoney(5000, XAF).replace(/\s/g, ' ')).toBe('5 000 FCFA');
  });
  it('formats EUR with two decimals', () => {
    expect(formatMoney(1250, EUR).replace(/\s/g, ' ')).toBe('12,50 €');
  });
});

describe('toMinor', () => {
  it('rounds to the nearest minor unit', () => {
    expect(toMinor(12.505, 2)).toBe(1251);
  });
});
