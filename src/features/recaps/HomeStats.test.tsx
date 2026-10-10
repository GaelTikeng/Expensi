import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { currencyInfo } from '@/src/lib/currencies';
import type { RecapOverview, RecapStats } from '@/src/lib/schemas/recap';
import { HomeStats } from './HomeStats';

const stats = (over: Partial<RecapStats>): RecapStats => ({
  period: 'month',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  currency: 'XAF',
  totalMinor: 124550,
  count: 32,
  estimatedCount: 0,
  withProofCount: 3,
  previous: { periodStart: '2026-09-01', totalMinor: 310000, count: 60, deltaMinor: -185450, deltaPct: -60 },
  byCategory: [
    { categoryId: 'a', name: 'Food & Groceries', icon: null, colorHex: '#E67E22', totalMinor: 62000, count: 14, sharePct: 50, budgetMinor: 50000, budgetPct: 124 },
    { categoryId: 'b', name: 'Transport', icon: null, colorHex: '#3498DB', totalMinor: 62550, count: 18, sharePct: 50, budgetMinor: null, budgetPct: null },
  ],
  byPayee: [{ payee: 'Marché Mokolo', totalMinor: 42000, count: 8 }],
  byDay: [{ date: '2026-10-05', totalMinor: 12000, count: 2 }],
  largest: [],
  fixedMinor: 15000,
  variableMinor: 109550,
  otherCurrencies: [],
  ...over,
});

const overview: RecapOverview = { today: stats({ period: 'day' }), week: stats({ period: 'week', count: 12 }), month: stats({}) };

describe('HomeStats', () => {
  it('renders one card per statistic from the overview', async () => {
    await render(<HomeStats overview={overview} lookup={currencyInfo} />);
    expect(screen.getByText('This week, day by day')).toBeOnTheScreen();
    expect(screen.getByText('This month by category')).toBeOnTheScreen();
    expect(screen.getByText('124% of budget')).toBeOnTheScreen();
    expect(screen.getByText('This month vs last month')).toBeOnTheScreen();
    expect(screen.getByText('Fixed charges vs everything else')).toBeOnTheScreen();
    expect(screen.getByText('Marché Mokolo')).toBeOnTheScreen();
  });

  it('opens the matching recap when a card is tapped', async () => {
    await render(<HomeStats overview={overview} lookup={currencyInfo} />);
    await fireEvent.press(screen.getByText('This week, day by day'));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/recaps', params: expect.objectContaining({ period: 'week' }) }));
  });

  it('shows an empty state when nothing is recorded', async () => {
    const empty: RecapOverview = { ...overview, week: stats({ count: 0, totalMinor: 0 }), month: stats({ count: 0, totalMinor: 0, byCategory: [], byPayee: [], fixedMinor: 0 }) };
    await render(<HomeStats overview={empty} lookup={currencyInfo} />);
    expect(screen.getByText('Nothing recorded this month yet')).toBeOnTheScreen();
    expect(screen.queryByText('This month by category')).toBeNull();
  });
});
