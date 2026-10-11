import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';

import { setFormatLocale } from '@/src/lib/locale';
import { getPrefs, setPrefs } from '@/src/lib/prefs';
import { i18n } from './index';
import { FORMAT_LOCALES, isLanguage, type Language, type LanguagePref } from './languages';

/** The phone's first preferred language if we support it, else English. */
export function deviceLanguage(): Language {
  for (const l of getLocales()) {
    if (isLanguage(l.languageCode)) return l.languageCode;
  }
  return 'en';
}

export function resolveLanguage(pref: LanguagePref): Language {
  return pref === 'system' ? deviceLanguage() : pref;
}

let pref: LanguagePref = 'system';
const listeners = new Set<() => void>();

/**
 * Switches the UI language and number/date formatting at once. `persist`
 * stores the choice on this device (the account copy is written by the
 * Language screen through PATCH /api/me).
 */
export async function applyLanguage(next: LanguagePref, { persist = true }: { persist?: boolean } = {}): Promise<void> {
  pref = next;
  const lang = resolveLanguage(next);
  setFormatLocale(FORMAT_LOCALES[lang]);
  await i18n.changeLanguage(lang);
  listeners.forEach((l) => l());
  if (persist) await setPrefs({ language: next });
}

/** Reads this device's stored choice and applies it; call once at start. */
export async function loadLanguage(): Promise<void> {
  const { language } = await getPrefs();
  await applyLanguage(language, { persist: false });
}

/** The current choice ("system" or a language), re-rendering on change. */
export function useLanguagePref(): LanguagePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pref,
    () => pref,
  );
}
