import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import AccountScreen from './AccountScreen';

// `mock` prefix: jest.mock factories may only reference such variables.
const mockSignOut = jest.fn(async () => undefined);
const mockDeleteAccount = jest.fn(async () => undefined);
const mockConfirm = jest.fn(async (_opts: { title: string }) => true);
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

jest.mock('@clerk/expo', () => ({ useAuth: () => ({ signOut: mockSignOut, getToken: async () => 'test-token' }) }));
jest.mock('@/src/components/action-sheet', () => ({ useActionSheets: () => ({ confirm: mockConfirm, show: jest.fn() }) }));
jest.mock('@/src/features/settings/useMe', () => ({
  useMe: () => ({ profile: mockProfile, currencies: [], loading: false, saving: false, error: null, update: jest.fn(), deleteAccount: mockDeleteAccount }),
}));
jest.mock('@/src/features/notifications/useRecapReminders', () => ({
  useRecapReminders: () => ({ prefs: { weeklyRecapReminder: true, monthlyRecapReminder: false }, supported: true, unavailableReason: null, setWeekly: jest.fn(), setMonthly: jest.fn() }),
}));
jest.mock('@/src/lib/appearance', () => ({
  APPEARANCE_OPTIONS: [{ value: 'system', label: 'Same as the phone' }],
  useAppearance: () => ({ appearance: 'system', setAppearance: jest.fn() }),
}));

async function renderHub() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={qc}>
      <AccountScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('AccountScreen (E17)', () => {
  it('is a menu: header, grouped rows with short values, nothing editable in place', async () => {
    await renderHub();
    expect(screen.getByText('Gaël Tikeng')).toBeOnTheScreen();
    expect(screen.getByText('+237 690 92 00 54')).toBeOnTheScreen();
    expect(screen.getByText('GT')).toBeOnTheScreen();
    for (const title of ['Account', 'Preferences', 'Notifications', 'Data', 'Legal']) expect(screen.getByText(title)).toBeOnTheScreen();
    for (const row of ['Personal information', 'Currency', 'Timezone', 'Appearance', 'Reminders', 'Export expenses', 'AI usage', 'Privacy policy', 'Sign out', 'Delete account']) {
      expect(screen.getByLabelText(row)).toBeOnTheScreen();
    }
    expect(screen.getByText('XAF')).toBeOnTheScreen();
    expect(screen.getByText('Douala')).toBeOnTheScreen();
    expect(screen.getByText('Weekly')).toBeOnTheScreen();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('opens a screen per row', async () => {
    await renderHub();
    const routes: [string, string][] = [
      ['Personal information', '/account/profile'],
      ['Currency', '/account/currency'],
      ['Timezone', '/account/timezone'],
      ['Appearance', '/account/appearance'],
      ['Reminders', '/account/reminders'],
      ['Export expenses', '/export'],
      ['AI usage', '/account/usage'],
      ['Privacy policy', '/privacy'],
    ];
    for (const [label, href] of routes) {
      await fireEvent.press(screen.getByLabelText(label));
      expect(router.push).toHaveBeenLastCalledWith(href);
    }
  });

  it('asks before signing out', async () => {
    await renderHub();
    mockConfirm.mockResolvedValueOnce(false);
    await fireEvent.press(screen.getByLabelText('Sign out'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign out?' })));
    expect(mockSignOut).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Sign out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });

  it('asks before deleting the account', async () => {
    await renderHub();
    mockConfirm.mockResolvedValueOnce(false);
    await fireEvent.press(screen.getByLabelText('Delete account'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete your account?' })));
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Delete account'));
    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
