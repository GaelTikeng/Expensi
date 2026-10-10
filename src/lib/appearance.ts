import { colorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getPrefs, setPrefs, type DevicePrefs } from './prefs';

export type Appearance = DevicePrefs['appearance'];

export const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'Same as the phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

let stopFollowingMedia: (() => void) | null = null;

/**
 * E17: the user's choice wins over the system scheme. "system" follows the
 * device; on web NativeWind's own `set('system')` only clears the `dark`
 * class, so the media query is mirrored by hand.
 */
export function applyAppearance(pref: Appearance): void {
  stopFollowingMedia?.();
  stopFollowingMedia = null;
  if (pref !== 'system') {
    colorScheme.set(pref);
    return;
  }
  if (Platform.OS === 'web') {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => colorScheme.set(query.matches ? 'dark' : 'light');
    follow();
    query.addEventListener('change', follow);
    stopFollowingMedia = () => query.removeEventListener('change', follow);
    return;
  }
  colorScheme.set('system');
}

/** Reads the stored preference and applies it; call once at app start. */
export async function loadAppearance(): Promise<Appearance> {
  const { appearance } = await getPrefs();
  applyAppearance(appearance);
  return appearance;
}

export function useAppearance() {
  const [appearance, setValue] = useState<Appearance>('system');
  useEffect(() => {
    let cancelled = false;
    void getPrefs().then((p) => {
      if (!cancelled) setValue(p.appearance);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const setAppearance = useCallback(async (next: Appearance) => {
    setValue(next);
    applyAppearance(next);
    await setPrefs({ appearance: next });
  }, []);
  return { appearance, setAppearance };
}
