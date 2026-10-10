import { describe, expect, it } from 'vitest';

import type { ImportItemDto } from '@/src/lib/schemas/import';
import { committableIds, reviewItems } from './review-utils';

const base: ImportItemDto = {
  id: '11111111-1111-4111-8111-111111111111',
  importId: 'imp',
  lineIndex: 0,
  rawText: 'Riz 5.000',
  amountMinor: 5000,
  currency: 'XAF',
  occurredOn: '2026-10-01',
  description: 'Riz',
  payee: null,
  categoryGuess: null,
  categoryId: null,
  confidence: 0.95,
  ambiguityNote: null,
  lineKind: 'expense',
  reviewState: 'pending',
  editedByUser: false,
  possibleDuplicateOf: null,
  expenseId: null,
};

describe('reviewItems', () => {
  it('pre-ticks clean lines', () => {
    const [r] = reviewItems([base]);
    expect(r.severity).toBe('ok');
    expect(r.defaultSelected).toBe(true);
  });
  it('never pre-ticks a likely duplicate and explains why', () => {
    const [r] = reviewItems([{ ...base, possibleDuplicateOf: { id: 'x', description: 'Riz marché', amountMinor: 5000, currency: 'XAF', occurredOn: '2026-10-01', payee: null, categoryId: null, source: 'manual' } }]);
    expect(r.defaultSelected).toBe(false);
    expect(r.severity).toBe('verify');
    expect(r.reason).toMatch(/duplicate/);
  });
  it('treats a user edit as confirmed', () => {
    const [r] = reviewItems([{ ...base, confidence: 0.2, editedByUser: true }]);
    expect(r.severity).toBe('ok');
  });
  it('blocks totals', () => {
    const [r] = reviewItems([{ ...base, lineKind: 'total' }]);
    expect(r.severity).toBe('blocked');
  });
});

describe('committableIds', () => {
  it('drops selected rows that still lack an amount or date', () => {
    const items = reviewItems([
      base,
      { ...base, id: '22222222-2222-4222-8222-222222222222', amountMinor: null },
      { ...base, id: '33333333-3333-4333-8333-333333333333', occurredOn: null },
    ]);
    const selected = new Set(items.map((r) => r.item.id));
    expect(committableIds(items, selected)).toEqual([base.id]);
  });
});
