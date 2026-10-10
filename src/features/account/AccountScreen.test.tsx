import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AccountScreen from './AccountScreen';

// `mock` prefix: jest.mock factories may only reference such variables.
const mockUpdate = jest.fn(async () => undefined);
const mockProfile = {
  id: 'u1',
  email: 'gael@nyota.ltd',
  displayName: 'Gaël Tikeng',
  phone: '+237 690 92 00 54',
  defaultCurrency: 'XAF',
  timezone: 'Africa/Douala',
  imageUrl: null,
  avatarKey: null,
  avatarUrl: null,
};

jest.mock('@/src/features/settings/useMe', () => ({
  useMe: () => ({ profile: mockProfile, currencies: [{ code: 'XAF', exponent: 0, symbol: 'FCFA', name: 'Central African CFA franc' }], loading: false, saving: false, error: null, update: mockUpdate, deleteAccount: jest.fn() }),
}));
jest.mock('@/src/features/notifications/useRecapReminders', () => ({
  useRecapReminders: () => ({ prefs: { weeklyRecapReminder: true, monthlyRecapReminder: false }, supported: true, unavailableReason: null, setWeekly: jest.fn(), setMonthly: jest.fn() }),
}));
jest.mock('@/src/lib/appearance', () => ({
  APPEARANCE_OPTIONS: [{ value: 'system', label: 'Same as the phone' }],
  useAppearance: () => ({ appearance: 'system', setAppearance: jest.fn() }),
}));
jest.mock('@/src/lib/api', () => ({ apiFetch: jest.fn(async () => ({ extract: { used: 1, limit: 50 }, narrative: { used: 2, limit: 120 } })) }));

async function renderHub() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={qc}>
      <AccountScreen />
    </QueryClientProvider>,
  );
}

describe('AccountScreen (E17)', () => {
  it('shows who is signed in and every section', async () => {
    await renderHub();
    expect(screen.getByText('Gaël Tikeng')).toBeOnTheScreen();
    expect(screen.getByText('+237 690 92 00 54')).toBeOnTheScreen();
    expect(screen.getByText('GT')).toBeOnTheScreen();
    for (const label of ['Personal information', 'Currency', 'Timezone', 'Appearance', 'Weekly recap', 'Monthly recap', 'Export expenses', 'Privacy policy', 'Sign out', 'Delete account']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(await screen.findByText('1 / 50')).toBeOnTheScreen();
  });

  it('opens the profile and the export screens', async () => {
    await renderHub();
    await fireEvent.press(screen.getByText('Personal information'));
    expect(router.push).toHaveBeenCalledWith('/account/profile');
    await fireEvent.press(screen.getByText('Export expenses'));
    expect(router.push).toHaveBeenCalledWith('/export');
  });
});
