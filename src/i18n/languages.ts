/**
 * E14 language constants. Pure: shared by the app, the API schemas and the
 * server (no i18next, no native imports).
 */
export const LANGUAGES = ['en', 'fr', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguagePref = 'system' | Language;

/** Each language named in itself, for the picker. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', fr: 'Français', de: 'Deutsch' };

/** Formatting locale per language. English uses en-GB for DD/MM dates. */
export const FORMAT_LOCALES: Record<Language, string> = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };

export const isLanguage = (v: unknown): v is Language => typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v);

/** First supported language in an Accept-Language header ("fr-CM,fr;q=0.9,en;q=0.8" → fr). */
export function languageFromHeader(header: string | null | undefined): Language | null {
  if (!header) return null;
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((x) => x.trim().startsWith('q='));
      return { lang: tag.trim().slice(0, 2).toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return tags.map((x) => x.lang).find(isLanguage) ?? null;
}

/** Server side: the saved choice, else what the app said it shows, else English. */
export function requestLanguage(stored: string | null | undefined, acceptLanguage: string | null | undefined): Language {
  return isLanguage(stored) ? stored : (languageFromHeader(acceptLanguage) ?? 'en');
}
