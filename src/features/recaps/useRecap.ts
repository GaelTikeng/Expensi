import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RecapPeriod } from '@/src/lib/dates';
import type { RecapDto, RecapOverview } from '@/src/lib/schemas/recap';
import { recapsApi } from './api';

/**
 * Two-step load: stats first (fast, SQL only), then the narrative, so the
 * screen never waits on the model to show numbers.
 */
export function useRecap(period: RecapPeriod, start: string) {
  const { getToken } = useAuth();
  const api = useMemo(() => recapsApi(getToken), [getToken]);
  const [recap, setRecap] = useState<RecapDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // Fetches stats, then (for week/month) the narrative. Only touches state
  // after an await, so it is safe to call from an effect.
  const run = useCallback(
    async (mine: number) => {
      try {
        const stats = await api.get(period, start, false);
        if (mine !== seq.current) return;
        setRecap(stats);
        setLoading(false);
        setError(null);
        if (period !== 'day' && stats.stats.count > 0 && !stats.narrativeMd) {
          setNarrativeLoading(true);
          const withText = await api.get(period, start, true);
          if (mine !== seq.current) return;
          setRecap(withText);
        }
      } catch (err) {
        if (mine === seq.current) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setNarrativeLoading(false);
        }
      }
    },
    [api, period, start],
  );

  useEffect(() => {
    void run(++seq.current);
  }, [run]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    await run(mine);
  }, [run]);

  return { recap, loading, narrativeLoading, error, reload: load };
}

export function useRecapOverview() {
  const { getToken } = useAuth();
  const api = useMemo(() => recapsApi(getToken), [getToken]);
  const [overview, setOverview] = useState<RecapOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setOverview(await api.overview());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  return { overview, loading, error, reload };
}
