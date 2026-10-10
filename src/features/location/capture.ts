import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

export interface ExpensePlace {
  latitude: number;
  longitude: number;
  locationLabel: string | null;
}

const FIX_TIMEOUT_MS = 12_000;

function explain(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Allow location?', 'Your position is saved with this expense so you can see where it was made. It is never shared.', [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * E16 F16.2: rationale first, then the system prompt; Settings when the
 * user previously said no. Same shape as the notification flow (F5.4).
 */
export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    Alert.alert('Location is off', 'Turn it on in Settings to save where your expenses happen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]);
    return false;
  }
  if (!(await explain())) return false;
  const result = await Location.requestForegroundPermissionsAsync();
  return result.granted;
}

/** "Bastos, Yaoundé" from what the geocoder knows; null when nothing useful. */
export function formatPlace(a: Partial<Pick<Location.LocationGeocodedAddress, 'district' | 'subregion' | 'street' | 'name' | 'city' | 'region'>>): string | null {
  const area = a.district || a.subregion || a.street || a.name || null;
  const city = a.city || a.region || null;
  const parts = [area, city].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  if (parts.length === 2 && parts[0] === parts[1]) return parts[0];
  return parts.join(', ');
}

/**
 * One fix at balanced accuracy, then a best-effort reverse geocode for the
 * label. Offline or on web the label is null and the coordinates still save.
 */
export async function capturePlace(): Promise<ExpensePlace> {
  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Could not get a position. Try again outdoors or with Wi-Fi on.')), FIX_TIMEOUT_MS)),
  ]);
  const latitude = Number(fix.coords.latitude.toFixed(6));
  const longitude = Number(fix.coords.longitude.toFixed(6));
  let locationLabel: string | null = null;
  if (Platform.OS !== 'web') {
    try {
      const [first] = await Location.reverseGeocodeAsync({ latitude, longitude });
      locationLabel = first ? formatPlace(first) : null;
    } catch {
      locationLabel = null;
    }
  }
  return { latitude, longitude, locationLabel };
}

/** A link every phone and browser can open. */
export function mapsUrl(place: Pick<ExpensePlace, 'latitude' | 'longitude'>): string {
  const q = `${place.latitude},${place.longitude}`;
  if (Platform.OS === 'ios') return `maps:0,0?q=${q}`;
  if (Platform.OS === 'android') return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps?q=${q}`;
}
