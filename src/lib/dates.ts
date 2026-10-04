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

/* ── recap periods ────────────────────────────────────────────────────────── */

export type RecapPeriod = 'day' | 'week' | 'month';

export function endOfMonth(iso: ISODate): ISODate {
  const d = parseISODate(startOfMonth(iso));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISODate(d);
}

/** Normalises any date inside a period to that period's canonical start. */
export function periodStart(period: RecapPeriod, iso: ISODate): ISODate {
  switch (period) {
    case 'day':
      return iso;
    case 'week':
      return startOfWeek(iso);
    case 'month':
      return startOfMonth(iso);
  }
}

/** Inclusive date range covered by a period starting at `start`. */
export function periodRange(period: RecapPeriod, start: ISODate): { start: ISODate; end: ISODate } {
  const s = periodStart(period, start);
  switch (period) {
    case 'day':
      return { start: s, end: s };
    case 'week':
      return { start: s, end: addDays(s, 6) };
    case 'month':
      return { start: s, end: endOfMonth(s) };
  }
}

export function previousPeriodStart(period: RecapPeriod, start: ISODate): ISODate {
  const s = periodStart(period, start);
  switch (period) {
    case 'day':
      return addDays(s, -1);
    case 'week':
      return addDays(s, -7);
    case 'month': {
      const d = parseISODate(s);
      d.setMonth(d.getMonth() - 1);
      return toISODate(d);
    }
  }
}

export function nextPeriodStart(period: RecapPeriod, start: ISODate): ISODate {
  const s = periodStart(period, start);
  switch (period) {
    case 'day':
      return addDays(s, 1);
    case 'week':
      return addDays(s, 7);
    case 'month': {
      const d = parseISODate(s);
      d.setMonth(d.getMonth() + 1);
      return toISODate(d);
    }
  }
}

/** "Today", "This week", "October 2026", "Week of 28 Sep", … */
export function periodLabel(period: RecapPeriod, start: ISODate, now = new Date(), locale = 'en-GB'): string {
  const s = periodStart(period, start);
  const today = toISODate(now);
  if (period === 'day') return relativeDayLabel(s, now, locale);
  if (period === 'week') {
    if (s === startOfWeek(today)) return 'This week';
    if (s === addDays(startOfWeek(today), -7)) return 'Last week';
    return `Week of ${formatDayLabel(s, locale).replace(/^\w+\s/, '')}`;
  }
  if (s === startOfMonth(today)) return 'This month';
  return formatMonthLabel(s, locale);
}

/** Every day in the range, for charts. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/* ── timezones ────────────────────────────────────────────────────────────── */

/** Offset (ms) of `timeZone` from UTC at the given instant. Positive east of UTC. */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant at which a wall-clock time occurs in a zone. Used to turn
 * "the 5th at 09:00 in Africa/Douala" into a `timestamptz` for reminders.
 */
export function zonedTimeToUtc(dateISO: ISODate, hhmm: string, timeZone: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = dateISO.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h || 0, m || 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  let result = guess - offset;
  const offset2 = tzOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset) result = guess - offset2;
  return new Date(result);
}

/** Calendar date of an instant as seen in a zone. */
export function isoDateInZone(date: Date, timeZone: string): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function daysInMonth(iso: ISODate): number {
  return Number(endOfMonth(iso).slice(8));
}

/** The 31st in a 30-day month becomes the 30th. */
export function clampDayOfMonth(monthStart: ISODate, day: number): ISODate {
  const d = Math.min(Math.max(1, day), daysInMonth(monthStart));
  return `${monthStart.slice(0, 7)}-${pad(d)}`;
}
