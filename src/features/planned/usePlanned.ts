import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { useMe } from '@/src/features/settings/useMe';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import { plannedApi, recurringApi } from './api';
import { cancelFor, syncReminders } from './reminders';

/**
 * Upcoming plans. On load it also materialises fixed charges for this and
 * next month (F6.3) and syncs local reminders (F5.3).
 */
export function useUpcomingPlanned() {
  const { getToken } = useAuth();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const recurring = useMemo(() => recurringApi(getToken), [getToken]);
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  const [items, setItems] = useState<PlannedDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Captured when data arrives so render stays pure; refreshed on every reload.
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef(0);

  const run = useCallback(
    async (mine: number) => {
      try {
        await recurring.materialize().catch(() => undefined);
        const page = await api.list({ status: 'planned', limit: 500 });
        if (mine !== seq.current) return;
        setItems(page.items);
        setNow(Date.now());
        setError(null);
        void syncReminders(page.items, lookup);
      } catch (err) {
        if (mine === seq.current) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [api, recurring, lookup],
  );

  useEffect(() => {
    void run(++seq.current);
  }, [run]);

  const reload = useCallback(() => run(++seq.current), [run]);

  const overdue = items.filter((p) => new Date(p.scheduledAt).getTime() < now);
  const upcoming = items.filter((p) => new Date(p.scheduledAt).getTime() >= now);

  const skip = useCallback(
    async (id: string) => {
      const prev = items;
      setItems((s) => s.filter((p) => p.id !== id));
      try {
        await api.update(id, { status: 'skipped' });
        await cancelFor(id);
      } catch (err) {
        setItems(prev);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, items],
  );

  const remove = useCallback(
    async (id: string) => {
      const prev = items;
      setItems((s) => s.filter((p) => p.id !== id));
      try {
        await api.remove(id);
        await cancelFor(id);
      } catch (err) {
        setItems(prev);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, items],
  );

  return { items, overdue, upcoming, loading, error, reload, skip, remove, api, lookup };
}
