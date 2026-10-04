/**
 * Curated IANA zones for the settings picker. Hermes does not ship
 * Intl.supportedValuesOf('timeZone'), so this list is maintained by hand.
 * Africa first (target market), then common diaspora zones.
 */
export const TIMEZONES = [
  'Africa/Douala',
  'Africa/Lagos',
  'Africa/Kinshasa',
  'Africa/Libreville',
  'Africa/Bangui',
  'Africa/Brazzaville',
  'Africa/Malabo',
  'Africa/Ndjamena',
  'Africa/Abidjan',
  'Africa/Dakar',
  'Africa/Accra',
  'Africa/Casablanca',
  'Africa/Algiers',
  'Africa/Tunis',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Africa/Addis_Ababa',
  'Africa/Johannesburg',
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Montreal',
  'Asia/Dubai',
  'Asia/Shanghai',
  'UTC',
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export function isKnownTimezone(value: string): value is Timezone {
  return (TIMEZONES as readonly string[]).includes(value);
}
