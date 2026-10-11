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
