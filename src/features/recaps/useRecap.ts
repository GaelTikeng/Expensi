import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { RecapPeriod } from '@/src/lib/dates';
import { errorMessage, keys } from '@/src/lib/query';
import type { RecapDto } from '@/src/lib/schemas/recap';
import { recapsApi } from './api';

/**
 * Stats for one period from the shared cache (D15). The AI narrative is
 * requested on demand through `loadNarrative`, so a visit never spends a
 * model call unless the user asks; one already stored for these stats comes
 * back with the stats.
 */
export function useRecap(period: RecapPeriod, start: string) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => recapsApi(getToken), [getToken]);
  const queryKey = keys.recaps.one(period, start);
  const slot = `${period}:${start}`;

  const query = useQuery({ queryKey, queryFn: () => api.get(period, start, false) });

  // Keyed per period so switching periods mid-request shows the right state.
  const [narrativeBusy, setNarrativeBusy] = useState<Record<string, boolean>>({});
  const [narrativeErrors, setNarrativeErrors] = useState<Record<string, string | null>>({});

  /** F4.3: ask the model for the summary of the currently shown period. */
  const loadNarrative = useCallback(async () => {
    setNarrativeBusy((b) => ({ ...b, [slot]: true }));
    try {
      const withText = await api.get(period, start, true);
      qc.setQueryData(queryKey, withText);
      setNarrativeErrors((e) => ({ ...e, [slot]: withText.narrativeMd ? null : 'No summary could be written. Try again later.' }));
    } catch (err) {
      setNarrativeErrors((e) => ({ ...e, [slot]: errorMessage(err) }));
    } finally {
      setNarrativeBusy((b) => ({ ...b, [slot]: false }));
    }
    // queryKey derives from period + start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, period, start, qc, slot]);

  return {
    recap: query.data ?? null,
    loading: query.isPending,
    narrativeLoading: narrativeBusy[slot] ?? false,
    narrativeError: narrativeErrors[slot] ?? null,
    error: errorMessage(query.error),
    reload: () => query.refetch(),
    loadNarrative,
  };
}

/** F4.5: today / week / month stats for the home tiles. */
export function useRecapOverview() {
  const { getToken } = useAuth();
  const api = useMemo(() => recapsApi(getToken), [getToken]);
  const query = useQuery({ queryKey: keys.recaps.overview, queryFn: () => api.overview() });
  return { overview: query.data ?? null, loading: query.isPending, error: errorMessage(query.error), reload: () => query.refetch() };
}

export type { RecapDto };
