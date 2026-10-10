import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ImportItemDto } from '@/src/lib/schemas/import';
import { ImportItemRow } from './ImportItemRow';
import { reviewItems } from './review-utils';

const base: ImportItemDto = {
  id: 'item-1',
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
const currency = { code: 'XAF', exponent: 0, symbol: 'FCFA' };

describe('ImportItemRow', () => {
  it('renders the line and toggles its tick', async () => {
    const onToggle = jest.fn();
    const [reviewed] = reviewItems([base]);
    await render(<ImportItemRow reviewed={reviewed} selected currency={currency} onToggle={onToggle} onEdit={jest.fn()} />);
    expect(screen.getByText('Riz')).toBeOnTheScreen();
    expect(screen.getByText('5 000 FCFA')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers Compare only when the line looks like an existing expense', async () => {
    const dup = { ...base, possibleDuplicateOf: { id: 'x', description: 'Riz marché', amountMinor: 5000, currency: 'XAF', occurredOn: '2026-10-01', payee: null, categoryId: null, source: 'manual' as const } };
    const onCompare = jest.fn();
    const [reviewed] = reviewItems([dup]);
    await render(<ImportItemRow reviewed={reviewed} selected={false} currency={currency} onToggle={jest.fn()} onEdit={jest.fn()} onCompare={onCompare} />);
    await fireEvent.press(screen.getByText(/Looks like a duplicate/));
    expect(onCompare).toHaveBeenCalledTimes(1);

    const [clean] = reviewItems([base]);
    await render(<ImportItemRow reviewed={clean} selected currency={currency} onToggle={jest.fn()} onEdit={jest.fn()} onCompare={onCompare} />);
    expect(screen.queryByText(/Compare/)).toBeNull();
  });
});
