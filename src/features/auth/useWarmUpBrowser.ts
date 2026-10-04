import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Closes the in-app browser tab when the OAuth redirect lands back in the app.
WebBrowser.maybeCompleteAuthSession();

/**
 * Android only: pre-launches the Custom Tabs process so the Google button
 * opens instantly instead of after a visible pause.
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}
