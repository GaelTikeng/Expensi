import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

import { isLanguage, LANGUAGES, type Language } from './languages';

/**
 * E14: English, French, German. This module has no native imports, so it
 * also runs under Node (unit tests, shared helpers); the phone's language
 * and the stored choice live in `./language.ts`.
 */
export * from './languages';

/** Our own instance; `initReactI18next` registers it for `useTranslation`. */
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, de: { translation: de } },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
  // Resources are bundled, so initialisation is synchronous.
  initAsync: false,
});

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : 'en';
}

/**
 * Plural pick without Intl.PluralRules (not guaranteed under Hermes): keys
 * come in `_one` / `_other` pairs. French treats 0 as singular.
 */
export function pluralKey<K extends string>(base: K, n: number): `${K}_one` | `${K}_other` {
  const one = currentLanguage() === 'fr' ? n <= 1 : n === 1;
  return `${base}_${one ? 'one' : 'other'}` as `${K}_one` | `${K}_other`;
}

export { i18n };
export const t = i18n.t.bind(i18n);
