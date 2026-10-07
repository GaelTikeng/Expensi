import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/src/lib/api';

export interface MeProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  defaultCurrency: string;
  timezone: string;
}

export interface CurrencyOption {
  code: string;
  exponent: number;
  symbol: string;
  name: string;
}

export type MePatch = Partial<Pick<MeProfile, 'defaultCurrency' | 'timezone'>>;

type GetToken = () => Promise<string | null>;

async function fetchAll(getToken: GetToken) {
  const [me, cur] = await Promise.all([
    apiFetch<MeProfile>('/api/me', getToken),
    apiFetch<{ currencies: CurrencyOption[] }>('/api/currencies', getToken),
  ]);
  return { me, currencies: cur.currencies };
}

/** Loads /api/me and /api/currencies; optimistic updates for preferences. */
export function useMe() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load. State is only touched after the network round-trip resolves.
  useEffect(() => {
    let cancelled = false;
    fetchAll(getToken)
      .then(({ me, currencies: cur }) => {
        if (cancelled) return;
        setProfile(me);
        setCurrencies(cur);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  /** Explicit refresh (pull-to-refresh, retry button). */
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { me, currencies: cur } = await fetchAll(getToken);
      setProfile(me);
      setCurrencies(cur);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const update = useCallback(
    async (patch: MePatch) => {
      if (!profile) return;
      const previous = profile;
      setProfile({ ...profile, ...patch });
      setSaving(true);
      setError(null);
      try {
        const saved = await apiFetch<MeProfile>('/api/me', getToken, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        setProfile(saved);
      } catch (err) {
        setProfile(previous);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [profile, getToken],
  );

  const deleteAccount = useCallback(async () => {
    await apiFetch<{ ok: true }>('/api/me', getToken, { method: 'DELETE' });
  }, [getToken]);

  return { profile, currencies, loading, saving, error, reload, update, deleteAccount };
}
