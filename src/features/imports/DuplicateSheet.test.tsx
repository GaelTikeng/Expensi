import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ImportItemDto } from '@/src/lib/schemas/import';
import { DuplicateSheet } from './DuplicateSheet';

const item: ImportItemDto = {
  id: 'item-1',
  importId: 'imp',
  lineIndex: 1,
  rawText: '28/09 | Shared taxi to office | 350',
  amountMinor: 350,
  currency: 'XAF',
  occurredOn: '2026-09-28',
  description: 'Shared taxi to office',
  payee: 'Taxi',
  categoryGuess: 'Transport',
  categoryId: 'cat-tx',
  confidence: 0.9,
  ambiguityNote: null,
  lineKind: 'expense',
  reviewState: 'pending',
  editedByUser: false,
  possibleDuplicateOf: null,
  expenseId: null,
};
const existing = { id: 'exp-9', description: 'Shared taxi home', amountMinor: 350, currency: 'XAF', occurredOn: '2026-09-28', payee: 'Taxi', categoryId: 'cat-tx', source: 'manual' as const };
const currency = { code: 'XAF', exponent: 0, symbol: 'FCFA' };

async function renderSheet(over: Partial<React.ComponentProps<typeof DuplicateSheet>> = {}) {
  const handlers = { onSkip: jest.fn(), onKeepBoth: jest.fn(), onDeleteExisting: jest.fn(), onDeleteThis: jest.fn(), onClose: jest.fn() };
  await render(
    <DuplicateSheet
      pair={{ item, existing }}
      currency={currency}
      categoryName={(id) => (id === 'cat-tx' ? 'Transport' : undefined)}
      committed={false}
      busy={false}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('DuplicateSheet', () => {
  it('shows both records side by side with the differing field', async () => {
    await renderSheet();
    expect(screen.getByText('Possible duplicate')).toBeOnTheScreen();
    expect(screen.getByText('Shared taxi to office')).toBeOnTheScreen();
    expect(screen.getByText('Shared taxi home')).toBeOnTheScreen();
    expect(screen.getAllByText('350 FCFA')).toHaveLength(2);
    expect(screen.getByText('Entered by hand')).toBeOnTheScreen();
  });

  it('offers skip / replace / keep both before commit', async () => {
    const h = await renderSheet();
    await fireEvent.press(screen.getByText('Skip this line'));
    expect(h.onSkip).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Import this line, delete the saved expense'));
    expect(h.onDeleteExisting).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Import anyway, keep both'));
    expect(h.onKeepBoth).toHaveBeenCalledTimes(1);
  });

  it('offers keep-one choices after commit', async () => {
    const h = await renderSheet({ committed: true });
    expect(screen.queryByText('Skip this line')).toBeNull();
    await fireEvent.press(screen.getByText('Keep the saved expense, delete this one'));
    expect(h.onDeleteThis).toHaveBeenCalledTimes(1);
  });

  it('hides the actions while a deletion is in flight', async () => {
    await renderSheet({ busy: true });
    expect(screen.queryByText('Skip this line')).toBeNull();
  });
});
