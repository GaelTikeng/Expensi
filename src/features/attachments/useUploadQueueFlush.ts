import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { flush } from './queue';

/**
 * Mount once in the signed-in shell: flushes parked uploads when the app
 * starts and whenever it returns to the foreground.
 */
export function useUploadQueueFlush() {
  const { getToken } = useAuth();
  useEffect(() => {
    void flush(getToken);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flush(getToken);
    });
    return () => sub.remove();
  }, [getToken]);
}
