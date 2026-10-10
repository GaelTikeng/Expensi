import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { apiFetch } from '@/src/lib/api';
import { CURRENCIES, type CurrencyOption } from '@/src/lib/currencies';
import { errorMessage, keys, REFERENCE_STALE } from '@/src/lib/query';

export type { CurrencyOption };

export interface MeProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  defaultCurrency: string;
  timezone: string;
}

export type MePatch = Partial<Pick<MeProfile, 'defaultCurrency' | 'timezone'>>;

/**
 * Profile from the cache (D15) plus the fixed currency list (D14). Preference
 * updates are optimistic and roll back on failure. A currency change
 * invalidates recaps, which are computed in the default currency.
 */
export function useMe() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: keys.me,
    queryFn: () => apiFetch<MeProfile>('/api/me', getToken),
    staleTime: REFERENCE_STALE,
  });

  const mutation = useMutation({
    mutationFn: (patch: MePatch) => apiFetch<MeProfile>('/api/me', getToken, { method: 'PATCH', body: JSON.stringify(patch) }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.me });
      const previous = qc.getQueryData<MeProfile>(keys.me);
      if (previous) qc.setQueryData<MeProfile>(keys.me, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.me, ctx.previous);
    },
    onSuccess: (saved, patch) => {
      qc.setQueryData(keys.me, saved);
      if (patch.defaultCurrency) void qc.invalidateQueries({ queryKey: keys.recaps.all });
    },
  });

  const update = useCallback((patch: MePatch) => mutation.mutateAsync(patch).then(() => undefined, () => undefined), [mutation]);

  const deleteAccount = useCallback(async () => {
    await apiFetch<{ ok: true }>('/api/me', getToken, { method: 'DELETE' });
  }, [getToken]);

  return {
    profile: query.data ?? null,
    currencies: CURRENCIES,
    loading: query.isPending,
    saving: mutation.isPending,
    error: errorMessage(query.error) ?? errorMessage(mutation.error),
    reload: () => query.refetch(),
    update,
    deleteAccount,
  };
}
