/**
 * The BCP-47 locale used to format numbers and dates (E14). Set by the app
 * when the language changes; unset on the server and in unit tests, where
 * each formatter keeps its historical default (money: fr-FR, dates: en-GB).
 * Pure module: safe to import from server code.
 */
let current: string | null = null;

export function formatLocale(): string | null {
  return current;
}

export function setFormatLocale(locale: string | null): void {
  current = locale;
}
