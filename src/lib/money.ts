/**
 * Money helpers. Amounts are integer minor units; the exponent comes from the
 * `currencies` table. Never do arithmetic on formatted strings.
 */

export interface CurrencyInfo {
  code: string;
  exponent: number;
  symbol: string;
}

export function toMajor(amountMinor: number, exponent: number): number {
  return amountMinor / 10 ** exponent;
}

export function toMinor(amountMajor: number, exponent: number): number {
  return Math.round(amountMajor * 10 ** exponent);
}

/**
 * Formats with French/Central African conventions by default: thin space as
 * thousands separator, comma as decimal. `5000 XAF` → "5 000 FCFA".
 */
export function formatMoney(
  amountMinor: number,
  currency: CurrencyInfo,
  locale = 'fr-FR',
): string {
  const major = toMajor(amountMinor, currency.exponent);
  const num = new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency.exponent,
    maximumFractionDigits: currency.exponent,
  }).format(major);
  return `${num} ${currency.symbol}`;
}

/**
 * Parses user input such as "5.000", "5 000", "12,50", "1.250,75" into minor
 * units. Returns null when the text is not a number.
 */
export function parseLocaleAmount(text: string, exponent: number): number | null {
  const cleaned = text.replace(/[^\d.,\s  -]/g, '').trim();
  if (!cleaned) return null;

  // Last separator decides: if it's a comma, it's the decimal mark.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let integerPart = cleaned;
  let fractionPart = '';

  if (lastComma > lastDot) {
    integerPart = cleaned.slice(0, lastComma);
    fractionPart = cleaned.slice(lastComma + 1);
  } else if (lastDot > -1 && exponent > 0 && cleaned.length - lastDot - 1 <= exponent) {
    // "12.50" on a 2-decimal currency: treat the dot as decimal.
    integerPart = cleaned.slice(0, lastDot);
    fractionPart = cleaned.slice(lastDot + 1);
  }

  const digits = integerPart.replace(/[^\d-]/g, '');
  if (!digits || digits === '-') return null;
  const frac = fractionPart.replace(/\D/g, '').padEnd(exponent, '0').slice(0, exponent);
  const sign = digits.startsWith('-') ? -1 : 1;
  const whole = Math.abs(parseInt(digits, 10));
  if (Number.isNaN(whole)) return null;
  return sign * (whole * 10 ** exponent + (frac ? parseInt(frac, 10) : 0));
}
