import { formatMoney } from '@/src/lib/money';
import { formatLocale, setFormatLocale } from '@/src/lib/locale';

const mockLocales = jest.fn(() => [{ languageCode: 'fr' }]);
jest.mock('expo-localization', () => ({ getLocales: () => mockLocales() }));
const mockSetPrefs = jest.fn(async (_patch: object) => undefined);
jest.mock('@/src/lib/prefs', () => ({ getPrefs: async () => ({ language: 'de' }), setPrefs: (p: object) => mockSetPrefs(p) }));

// eslint-disable-next-line import/first
import { i18n } from './index';
// eslint-disable-next-line import/first
import { applyLanguage, deviceLanguage, loadLanguage, resolveLanguage } from './language';

const xaf = { code: 'XAF', exponent: 0, symbol: 'FCFA' };

afterEach(async () => {
  setFormatLocale(null);
  await i18n.changeLanguage('en');
  jest.clearAllMocks();
});

describe('device language', () => {
  it('takes the first supported language from the phone, else English', () => {
    mockLocales.mockReturnValueOnce([{ languageCode: 'sw' }, { languageCode: 'de' }]);
    expect(deviceLanguage()).toBe('de');
    mockLocales.mockReturnValueOnce([{ languageCode: 'sw' }]);
    expect(deviceLanguage()).toBe('en');
  });

  it('resolves "system" to the phone language', () => {
    expect(resolveLanguage('system')).toBe('fr');
    expect(resolveLanguage('de')).toBe('de');
  });
});

describe('applyLanguage', () => {
  it('switches the UI and the number format together, and remembers the choice', async () => {
    await applyLanguage('de');
    expect(i18n.language).toBe('de');
    expect(formatLocale()).toBe('de-DE');
    expect(formatMoney(5000, xaf)).toMatch(/^5\.000 FCFA$/);
    expect(mockSetPrefs).toHaveBeenCalledWith({ language: 'de' });

    await applyLanguage('system', { persist: false });
    expect(i18n.language).toBe('fr');
    expect(formatMoney(5000, xaf).replace(/\s/g, ' ')).toBe('5 000 FCFA');
    expect(mockSetPrefs).toHaveBeenCalledTimes(1);

    await applyLanguage('en');
    expect(formatMoney(5000, xaf)).toBe('5,000 FCFA');
  });

  it('loads the stored choice at start without writing it back', async () => {
    await loadLanguage();
    expect(i18n.language).toBe('de');
    expect(mockSetPrefs).not.toHaveBeenCalled();
  });
});
