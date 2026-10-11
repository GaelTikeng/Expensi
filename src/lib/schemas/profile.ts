import { z } from 'zod';

import { LANGUAGES, type Language } from '../../i18n/languages';
import { CURRENCY_CODES } from '../currencies';
import { isKnownTimezone } from '../timezones';

/** Avatars are JPEG, resized on device; 2 MB is generous for 512 px. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const avatarPresignSchema = z.object({
  sizeBytes: z.number().int().min(1).max(MAX_AVATAR_BYTES),
});

export interface AvatarPresignResponse {
  key: string;
  uploadUrl: string;
  expiresAt: string;
}

/** `users/{id}/avatar/{uuid}.jpg`: inside the per-user prefix the account purge deletes. */
export const avatarKeyFor = (userId: string, id: string) => `users/${userId}/avatar/${id}.jpg`;
export const isAvatarKeyOf = (userId: string, key: string) => new RegExp(`^users/${userId}/avatar/[0-9a-f-]{36}\\.jpg$`).test(key);

/** Loose international format: optional +, digits and spaces, 6–20 characters. */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ]{5,19}$/, 'Enter a phone number like +237 6 90 92 00 54');

/** `PATCH /api/me` body: preferences (F1.4) and profile fields (E15). */
export const mePatchSchema = z
  .object({
    defaultCurrency: z.string().length(3).toUpperCase().pipe(z.enum(CURRENCY_CODES)).optional(),
    timezone: z.string().refine((tz): boolean => isKnownTimezone(tz), 'Unknown timezone').optional(),
    expoPushToken: z.string().min(1).nullable().optional(),
    displayName: z.string().trim().min(1, 'Name is required').max(200).optional(),
    phone: phoneSchema.nullable().optional(),
    /** Key returned by `POST /api/me/avatar` once uploaded; null removes the custom avatar. */
    avatarKey: z.string().min(1).nullable().optional(),
    /** E14: null follows the phone's language. */
    language: z.enum(LANGUAGES).nullable().optional(),
  })
  .strict();
export type MePatchBody = z.infer<typeof mePatchSchema>;

export interface MeProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  defaultCurrency: string;
  timezone: string;
  /** Picture from the identity provider (Google via Clerk), if any. */
  imageUrl: string | null;
  /** Custom avatar uploaded in the app: its storage key and a short-lived view URL. */
  avatarKey: string | null;
  avatarUrl: string | null;
  /** E14: chosen language, or null to follow the phone. */
  language: Language | null;
}
