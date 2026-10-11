import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { i18n, LANGUAGES, pluralKey, t } from './index';

/** Every leaf key as a dotted path, plus the interpolation variables it uses. */
function leaves(obj: object, prefix = ''): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') for (const [p, vars] of leaves(v, path)) out.set(p, vars);
    else out.set(path, [...String(v).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort());
  }
  return out;
}

const files = { en, fr, de };

describe('translation files (E14)', () => {
  const reference = leaves(en);

  it.each(['fr', 'de'] as const)('%s has exactly the English keys', (lang) => {
    const keys = [...leaves(files[lang]).keys()].sort();
    expect(keys).toEqual([...reference.keys()].sort());
  });

  it.each(['fr', 'de'] as const)('%s uses the same {{variables}} as English', (lang) => {
    const mine = leaves(files[lang]);
    for (const [key, vars] of reference) expect([key, mine.get(key)]).toEqual([key, vars]);
  });

  it.each(LANGUAGES)('%s has no empty strings', (lang) => {
    for (const [key] of leaves(files[lang])) expect([key, (key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], files[lang]) as string).trim().length > 0]).toEqual([key, true]);
  });

  it('every plural comes as a _one / _other pair', () => {
    const keys = [...reference.keys()];
    for (const k of keys.filter((k) => k.endsWith('_one'))) expect(keys).toContain(k.replace(/_one$/, '_other'));
    for (const k of keys.filter((k) => k.endsWith('_other'))) expect(keys).toContain(k.replace(/_other$/, '_one'));
  });
});

describe('runtime', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('switches language and interpolates', async () => {
    expect(t('home.versus', { arrow: '↑', amount: '5 000 FCFA', period: 'yesterday' })).toBe('↑ 5 000 FCFA vs yesterday');
    await i18n.changeLanguage('fr');
    expect(t('tabs.expenses')).toBe('Dépenses');
    await i18n.changeLanguage('de');
    expect(t('tabs.expenses')).toBe('Ausgaben');
  });

  it('picks plural forms per language (French treats 0 as singular)', async () => {
    expect(t(pluralKey('home.items', 1), { n: 1 })).toBe('1 item');
    expect(t(pluralKey('home.items', 0), { n: 0 })).toBe('0 items');
    await i18n.changeLanguage('fr');
    expect(t(pluralKey('home.items', 0), { n: 0 })).toBe('0 dépense');
    expect(t(pluralKey('home.items', 2), { n: 2 })).toBe('2 dépenses');
    await i18n.changeLanguage('de');
    expect(t(pluralKey('home.items', 1), { n: 1 })).toBe('1 Ausgabe');
    expect(t(pluralKey('home.items', 3), { n: 3 })).toBe('3 Ausgaben');
  });
});
