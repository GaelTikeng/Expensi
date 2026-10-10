import type { CurrencyInfo } from './money';

/**
 * The currencies the app supports. A fixed list shared by client and server
 * (D14): pickers read it directly, the API validates against it, and nothing
 * has to be fetched before a form can render. Add a currency here, in one
 * place; the `currencies` table was dropped in migration 0001.
 */
export const CURRENCIES = [
  { code: 'XAF', exponent: 0, symbol: 'FCFA', name: 'Central African CFA franc' },
  { code: 'XOF', exponent: 0, symbol: 'CFA', name: 'West African CFA franc' },
  { code: 'EUR', exponent: 2, symbol: '€', name: 'Euro' },
  { code: 'USD', exponent: 2, symbol: '$', name: 'US dollar' },
  { code: 'GBP', exponent: 2, symbol: '£', name: 'Pound sterling' },
  { code: 'NGN', exponent: 2, symbol: '₦', name: 'Nigerian naira' },
] as const satisfies readonly (CurrencyInfo & { name: string })[];

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];
export type CurrencyOption = (typeof CURRENCIES)[number];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

export const DEFAULT_CURRENCY: CurrencyCode = 'XAF';

const BY_CODE = new Map<string, CurrencyOption>(CURRENCIES.map((c) => [c.code, c]));

export function isKnownCurrency(code: string): code is CurrencyCode {
  return BY_CODE.has(code);
}

/**
 * Formatting info for a code. Unknown codes (e.g. one an import detected that
 * we do not support) render with zero decimals and the code as symbol rather
 * than crashing.
 */
export function currencyInfo(code: string): CurrencyInfo {
  return BY_CODE.get(code) ?? { code, exponent: 0, symbol: code };
}
