import { describe, expect, it } from 'vitest';

import {
  addDays,
  formatDDMMYYYY,
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
