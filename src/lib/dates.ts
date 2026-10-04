/**
 * Calendar-date helpers. Dates are `YYYY-MM-DD` strings everywhere (DB `date`
 * columns, API payloads, UI state); a Date object only appears transiently for
 * arithmetic, always at local midnight, so the 1st stays the 1st in every zone.
 */

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight for an ISO date. Throws on malformed input. */
export function parseISODate(iso: ISODate): Date {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** True when the string is well-formed and names a real calendar day. */
export function isValidISODate(iso: string): boolean {
  const m = ISO_RE.exec(iso);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toISODate(d) === iso;
}

export function todayISO(now = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

/** Monday-based weeks, matching `recaps.period_start` for `week`. */
export function startOfWeek(iso: ISODate): ISODate {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** `YYYY-MM`, handy as a grouping key. */
export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}

export function formatDayLabel(iso: ISODate, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    parseISODate(iso),
  );
}

export function formatMonthLabel(iso: ISODate, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(parseISODate(iso));
}

export function relativeDayLabel(iso: ISODate, now = new Date(), locale = 'en-GB'): string {
  const today = toISODate(now);
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return formatDayLabel(iso, locale);
}

/** `04/10/2026` — the written convention in the target market. */
export function formatDDMMYYYY(iso: ISODate): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Parses `dd/mm/yyyy`, `dd-mm-yyyy`, `dd.mm.yyyy`, `dd/mm/yy`, or `dd/mm`
 * (current year). Returns null when the text is not a real date.
 */
export function parseDDMMYYYY(text: string, now = new Date()): ISODate | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?\s*$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : now.getFullYear();
  if (m[3] && m[3].length === 2) year += 2000;
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isValidISODate(iso) ? iso : null;
}
