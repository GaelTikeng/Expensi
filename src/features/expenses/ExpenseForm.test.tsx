import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CURRENCIES } from '@/src/lib/currencies';
import { ExpenseForm } from './ExpenseForm';

type Submitted = Parameters<React.ComponentProps<typeof ExpenseForm>['onSubmit']>[0];

async function renderForm(onSubmit = jest.fn<Promise<void>, [Submitted]>(async () => undefined)) {
  await render(<ExpenseForm categories={[]} currencies={CURRENCIES} defaultCurrency="XAF" submitLabel="Save expense" submitting={false} onSubmit={onSubmit} />);
  return onSubmit;
}

describe('ExpenseForm', () => {
  it('refuses to submit without an amount and a description', async () => {
    const onSubmit = await renderForm();
    await fireEvent.press(screen.getByText('Save expense'));
    await waitFor(() => expect(screen.getByText('Description is required')).toBeOnTheScreen());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits parsed values in minor units with the default currency', async () => {
    const onSubmit = await renderForm();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '5.000');
    await fireEvent.changeText(screen.getByPlaceholderText('What was it for?'), 'Riz au marché');
    await fireEvent.changeText(screen.getByPlaceholderText('Shop, person, company'), 'Marché Mokolo');
    await fireEvent.press(screen.getByText('Save expense'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ amountMinor: 5000, currency: 'XAF', description: 'Riz au marché', payee: 'Marché Mokolo', isEstimated: false });
    expect(onSubmit.mock.calls[0][0].occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('starts from an existing expense when editing', async () => {
    await render(
      <ExpenseForm
        initial={{ id: '0199c4b4-0000-7000-8000-000000000001', amountMinor: 7500, currency: 'XAF', occurredOn: '2026-10-01', description: 'Taxi', payee: null, categoryId: null, notes: null, isEstimated: true }}
        categories={[]}
        currencies={CURRENCIES}
        defaultCurrency="XAF"
        submitLabel="Save changes"
        submitting={false}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Taxi')).toBeOnTheScreen();
    // The field keeps the raw digits; the formatted amount is shown underneath.
    expect(screen.getByLabelText('Amount').props.value).toBe('7500');
  });
});
