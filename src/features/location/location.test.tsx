import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { capturePlace, formatPlace, mapsUrl } from './capture';
import { LocationField } from './LocationField';

jest.mock('@/src/lib/prefs', () => {
  let prefs = { saveLocation: false };
  return {
    getPrefs: jest.fn(async () => prefs),
    setPrefs: jest.fn(async (patch: object) => {
      prefs = { ...prefs, ...patch };
      return prefs;
    }),
  };
});

describe('formatPlace', () => {
  it('prefers district then city, dropping duplicates and blanks', () => {
    expect(formatPlace({ district: 'Bastos', city: 'Yaoundé' })).toBe('Bastos, Yaoundé');
    expect(formatPlace({ street: 'Rue 1.820', city: 'Yaoundé' })).toBe('Rue 1.820, Yaoundé');
    expect(formatPlace({ city: 'Douala', region: 'Littoral' })).toBe('Douala');
    expect(formatPlace({ district: 'Douala', city: 'Douala' })).toBe('Douala');
    expect(formatPlace({})).toBeNull();
  });
});

describe('mapsUrl', () => {
  it('uses the platform scheme', () => {
    const place = { latitude: 3.8886, longitude: 11.5174 };
    const os = Platform.OS;
    Platform.OS = 'android';
    expect(mapsUrl(place)).toBe('geo:0,0?q=3.8886,11.5174');
    Platform.OS = 'ios';
    expect(mapsUrl(place)).toBe('maps:0,0?q=3.8886,11.5174');
    Platform.OS = 'web';
    expect(mapsUrl(place)).toBe('https://www.google.com/maps?q=3.8886,11.5174');
    Platform.OS = os;
  });
});

describe('capturePlace', () => {
  it('rounds the fix and labels it from the geocoder', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({ coords: { latitude: 3.88861234567, longitude: 11.51741234567 } });
    await expect(capturePlace()).resolves.toEqual({ latitude: 3.888612, longitude: 11.517412, locationLabel: 'Bastos, Yaoundé' });
  });
  it('keeps the coordinates when the geocoder fails', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(capturePlace()).resolves.toMatchObject({ latitude: 3.8886, longitude: 11.5174, locationLabel: null });
  });
});

describe('LocationField', () => {
  const switchEl = () => screen.getByLabelText('Save my location');

  it('captures when switched on and clears when switched off', async () => {
    const onChange = jest.fn();
    await render(<LocationField value={null} onChange={onChange} isNew={false} />);
    expect(screen.getByText('Off')).toBeOnTheScreen();

    await fireEvent.press(switchEl());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ latitude: 3.8886, longitude: 11.5174, locationLabel: 'Bastos, Yaoundé' }));
  });

  it('clears the place when switched off', async () => {
    const onChange = jest.fn();
    await render(<LocationField value={{ latitude: 3.8886, longitude: 11.5174, locationLabel: 'Bastos, Yaoundé' }} onChange={onChange} isNew={false} />);
    expect(screen.getByText('Bastos, Yaoundé')).toBeOnTheScreen();
    await fireEvent.press(switchEl());
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('stays quiet when permission is refused for good', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, canAskAgain: false });
    const fixesBefore = (Location.getCurrentPositionAsync as jest.Mock).mock.calls.length;
    const onChange = jest.fn();
    await render(<LocationField value={null} onChange={onChange} isNew={false} />);
    await fireEvent.press(switchEl());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    // No fix is attempted without permission.
    expect((Location.getCurrentPositionAsync as jest.Mock).mock.calls.length).toBe(fixesBefore);
  });
});
