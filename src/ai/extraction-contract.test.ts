import { describe, expect, it } from 'vitest';

import {
  CONFIDENCE_REVIEW_THRESHOLD,
  classifyLine,
  reconcileAgainstTotal,
  type ExtractedLine,
} from './extraction-contract';

const base: ExtractedLine = {
  line_index: 0,
  raw_text: 'Riz 5.000',
  line_kind: 'expense',
  amount_minor: 5000,
  occurred_on: '2026-10-01',
  confidence: 0.95,
};

describe('classifyLine', () => {
  it('blocks totals and never pre-selects them', () => {
    const r = classifyLine({ ...base, line_kind: 'total', raw_text: 'TOTAL 25.000', amount_minor: 25000 });
    expect(r.severity).toBe('blocked');
    expect(r.defaultSelected).toBe(false);
  });

  it('blocks struck-through, header, subtotal, illegible lines', () => {
    for (const kind of ['struck_through', 'header', 'subtotal', 'illegible'] as const) {
      expect(classifyLine({ ...base, line_kind: kind }).severity).toBe('blocked');
    }
  });

  it('blocks a missing amount and surfaces the ambiguity note', () => {
    const r = classifyLine({ ...base, amount_minor: undefined, ambiguity_note: 'digit unclear' });
    expect(r.severity).toBe('blocked');
    expect(r.reason).toBe('digit unclear');
  });

  it('blocks zero or negative amounts', () => {
    expect(classifyLine({ ...base, amount_minor: 0 }).severity).toBe('blocked');
    expect(classifyLine({ ...base, amount_minor: -5 }).severity).toBe('blocked');
  });

  it('asks for verification, unticked, below the confidence threshold', () => {
    const r = classifyLine({ ...base, confidence: CONFIDENCE_REVIEW_THRESHOLD - 0.01 });
    expect(r.severity).toBe('verify');
    expect(r.defaultSelected).toBe(false);
  });

  it('treats a missing confidence as low confidence', () => {
    expect(classifyLine({ ...base, confidence: undefined }).severity).toBe('verify');
  });

  it('asks for a date but keeps the line ticked when only the date is missing', () => {
    const r = classifyLine({ ...base, occurred_on: undefined });
    expect(r.severity).toBe('verify');
    expect(r.defaultSelected).toBe(true);
  });

  it('passes a clean expense line', () => {
    expect(classifyLine(base)).toEqual({ severity: 'ok', defaultSelected: true });
  });
});

describe('reconcileAgainstTotal', () => {
  const lines: ExtractedLine[] = [
    { ...base, line_index: 0, amount_minor: 5000 },
    { ...base, line_index: 1, amount_minor: 7500 },
    { ...base, line_index: 2, line_kind: 'struck_through', amount_minor: 99999 },
    { ...base, line_index: 3, line_kind: 'total', amount_minor: 12500 },
  ];

  it('sums only expense lines and compares to the stated total', () => {
    expect(reconcileAgainstTotal(lines)).toEqual({
      statedTotalMinor: 12500,
      computedTotalMinor: 12500,
      discrepancyMinor: 0,
    });
  });

  it('reports a discrepancy when the written total disagrees', () => {
    const r = reconcileAgainstTotal([...lines.slice(0, 3), { ...lines[3], amount_minor: 13000 }]);
    expect(r.discrepancyMinor).toBe(500);
  });

  it('returns null discrepancy when no total is present', () => {
    const r = reconcileAgainstTotal(lines.slice(0, 2));
    expect(r.statedTotalMinor).toBeNull();
    expect(r.discrepancyMinor).toBeNull();
    expect(r.computedTotalMinor).toBe(12500);
  });
});
