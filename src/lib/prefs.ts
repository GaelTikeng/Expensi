import * as FileSystem from 'expo-file-system/legacy';

/**
 * Tiny per-device preference store (JSON file in app storage). For settings
 * that are inherently per device, such as which local reminders this phone
 * schedules. Anything that should follow the account lives in `users`.
 */
export interface DevicePrefs {
  weeklyRecapReminder: boolean;
  monthlyRecapReminder: boolean;
  /** Local time "HH:MM" for recap reminders. */
  recapReminderTime: string;
}

const DEFAULTS: DevicePrefs = { weeklyRecapReminder: false, monthlyRecapReminder: false, recapReminderTime: '09:00' };
const PATH = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}device-prefs.json`;

let cache: DevicePrefs | null = null;

export async function getPrefs(): Promise<DevicePrefs> {
  if (cache) return cache;
  try {
    const info = await FileSystem.getInfoAsync(PATH);
    cache = info.exists ? { ...DEFAULTS, ...(JSON.parse(await FileSystem.readAsStringAsync(PATH)) as Partial<DevicePrefs>) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export async function setPrefs(patch: Partial<DevicePrefs>): Promise<DevicePrefs> {
  const next = { ...(await getPrefs()), ...patch };
  cache = next;
  await FileSystem.writeAsStringAsync(PATH, JSON.stringify(next)).catch(() => undefined);
  return next;
}
