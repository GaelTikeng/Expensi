import { describe, expect, it } from 'vitest';

import {
  addDays,
  clampDayOfMonth,
  daysInMonth,
  eachDay,
  isoDateInZone,
  zonedTimeToUtc,
  formatDDMMYYYY,
  nextPeriodStart,
  periodLabel,
  periodRange,
  previousPeriodStart,
  isValidISODate,
  monthKey,
  parseDDMMYYYY,
  relativeDayLabel,
  startOfMonth,
  startOfWeek,
} from './dates';

describe('isValidISODate', () => {
  it('accepts real days and rejects impossible ones', () => {
    expect(isValidISODate('2026-10-04')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('04/10/2026')).toBe(false);
  });
});

describe('period starts', () => {
  it('startOfWeek is the Monday', () => {
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28'); // Sunday → previous Monday
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28'); // Monday stays
    expect(startOfWeek('2026-10-01')).toBe('2026-09-28'); // Thursday
  });
  it('startOfMonth and monthKey', () => {
    expect(startOfMonth('2026-10-04')).toBe('2026-10-01');
    expect(monthKey('2026-10-04')).toBe('2026-10');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('parseDDMMYYYY', () => {
  const now = new Date(2026, 9, 4);
  it('parses the common written forms', () => {
    expect(parseDDMMYYYY('04/10/2026', now)).toBe('2026-10-04');
    expect(parseDDMMYYYY('4-10-2026', now)).toBe('2026-10-04');
    expect(parseDDMMYYYY('04.10.26', now)).toBe('2026-10-04');
    expect(parseDDMMYYYY('04/10', now)).toBe('2026-10-04');
  });
  it('is DD/MM, never MM/DD', () => {
    expect(parseDDMMYYYY('10/04/2026', now)).toBe('2026-04-10');
  });
  it('rejects nonsense', () => {
    expect(parseDDMMYYYY('31/02/2026', now)).toBeNull();
    expect(parseDDMMYYYY('hello', now)).toBeNull();
  });
  it('round-trips with formatDDMMYYYY', () => {
    expect(formatDDMMYYYY('2026-10-04')).toBe('04/10/2026');
  });
});

describe('relativeDayLabel', () => {
  const now = new Date(2026, 9, 4);
  it('names today and yesterday', () => {
    expect(relativeDayLabel('2026-10-04', now)).toBe('Today');
    expect(relativeDayLabel('2026-10-03', now)).toBe('Yesterday');
    expect(relativeDayLabel('2026-10-01', now)).toMatch(/Oct/);
  });
});

describe('recap periods', () => {
  it('normalises starts and computes inclusive ranges', () => {
    expect(periodRange('day', '2026-10-04')).toEqual({ start: '2026-10-04', end: '2026-10-04' });
    expect(periodRange('week', '2026-10-04')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(periodRange('month', '2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodRange('month', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
  it('steps backwards and forwards', () => {
    expect(previousPeriodStart('month', '2026-01-15')).toBe('2025-12-01');
    expect(nextPeriodStart('month', '2026-12-01')).toBe('2027-01-01');
    expect(previousPeriodStart('week', '2026-10-04')).toBe('2026-09-21');
    expect(nextPeriodStart('day', '2026-10-31')).toBe('2026-11-01');
  });
  it('labels relative periods', () => {
    const now = new Date(2026, 9, 4);
    expect(periodLabel('week', '2026-10-04', now)).toBe('This week');
    expect(periodLabel('week', '2026-09-21', now)).toBe('Last week');
    expect(periodLabel('month', '2026-10-01', now)).toBe('This month');
    expect(periodLabel('month', '2026-09-01', now)).toBe('September 2026');
  });
  it('enumerates days', () => {
    expect(eachDay('2026-09-28', '2026-10-01')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
  });
});

describe('timezones', () => {
  it('converts wall-clock time in a fixed-offset zone', () => {
    expect(zonedTimeToUtc('2026-10-04', '09:00', 'Africa/Douala').toISOString()).toBe('2026-10-04T08:00:00.000Z');
  });
  it('handles DST zones', () => {
    expect(zonedTimeToUtc('2026-07-01', '09:00', 'Europe/Paris').toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(zonedTimeToUtc('2026-01-01', '09:00', 'Europe/Paris').toISOString()).toBe('2026-01-01T08:00:00.000Z');
  });
  it('reads the calendar date in a zone', () => {
    expect(isoDateInZone(new Date('2026-10-04T23:30:00Z'), 'Africa/Douala')).toBe('2026-10-05');
    expect(isoDateInZone(new Date('2026-10-04T23:30:00Z'), 'UTC')).toBe('2026-10-04');
  });
  it('clamps the day of month', () => {
    expect(clampDayOfMonth('2026-02-01', 31)).toBe('2026-02-28');
    expect(clampDayOfMonth('2026-04-01', 31)).toBe('2026-04-30');
    expect(clampDayOfMonth('2026-10-01', 5)).toBe('2026-10-05');
    expect(daysInMonth('2024-02-10')).toBe(29);
  });
});
