import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { currencyInfo } from '@/src/lib/currencies';
import { errorMessage, invalidate, keys } from '@/src/lib/query';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import { plannedApi, recurringApi } from './api';
import { cancelFor, syncReminders } from './reminders';

type Upcoming = { items: PlannedDto[] };

// F6.3 materialisation creates this and next month's plans for every active
// fixed charge. It is idempotent but costs a round trip, so it runs once per
// session (and again after a charge is created or edited), not on every visit.
const MATERIALIZE_EVERY = 6 * 60 * 60_000;
let materializedAt = 0;

export function markMaterializationStale() {
  materializedAt = 0;
}

export async function ensureMaterialized(recurring: ReturnType<typeof recurringApi>) {
  if (Date.now() - materializedAt < MATERIALIZE_EVERY) return;
  await recurring.materialize().catch(() => undefined);
  materializedAt = Date.now();
}

/**
 * Upcoming plans from the shared cache (D15). The first load of a session
 * also materialises fixed charges (F6.3) and syncs local reminders (F5.3).
 */
export function useUpcomingPlanned() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const recurring = useMemo(() => recurringApi(getToken), [getToken]);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: keys.planned.upcoming,
    queryFn: async (): Promise<Upcoming> => {
      await ensureMaterialized(recurring);
      const page = await api.list({ status: 'planned', limit: 500 });
      void syncReminders(page.items, currencyInfo);
      return { items: page.items };
    },
  });

  const items = query.data?.items ?? EMPTY;
  // "Now" is the moment the data arrived, so render stays pure.
  const now = query.dataUpdatedAt;
  const overdue = items.filter((p) => new Date(p.scheduledAt).getTime() < now);
  const upcoming = items.filter((p) => new Date(p.scheduledAt).getTime() >= now);

  const removeLocally = useCallback(
    (id: string) => {
      const previous = qc.getQueryData<Upcoming>(keys.planned.upcoming);
      qc.setQueryData<Upcoming>(keys.planned.upcoming, (old) => (old ? { items: old.items.filter((p) => p.id !== id) } : old));
      return () => {
        if (previous) qc.setQueryData(keys.planned.upcoming, previous);
      };
    },
    [qc],
  );

  const skip = useCallback(
    async (id: string) => {
      const rollback = removeLocally(id);
      try {
        await api.update(id, { status: 'skipped' });
        await cancelFor(id);
        setActionError(null);
        void invalidate.plans(qc);
      } catch (err) {
        rollback();
        setActionError(errorMessage(err));
      }
    },
    [api, qc, removeLocally],
  );

  const remove = useCallback(
    async (id: string) => {
      const rollback = removeLocally(id);
      try {
        await api.remove(id);
        await cancelFor(id);
        setActionError(null);
        void invalidate.plans(qc);
      } catch (err) {
        rollback();
        setActionError(errorMessage(err));
      }
    },
    [api, qc, removeLocally],
  );

  return {
    items,
    overdue,
    upcoming,
    loading: query.isPending,
    error: errorMessage(query.error) ?? actionError,
    reload: () => query.refetch(),
    skip,
    remove,
    api,
    lookup: currencyInfo,
  };
}

const EMPTY: PlannedDto[] = [];

/** The plan the Upcoming list already holds, so the detail screen opens instantly. */
export function findCachedPlan(qc: QueryClient, id: string): PlannedDto | undefined {
  return qc.getQueryData<Upcoming>(keys.planned.upcoming)?.items.find((p) => p.id === id);
}

/** Fixed charges with this month's status (F6.4), shared by the list and the edit screen. */
export function useRecurringList() {
  const { getToken } = useAuth();
  const recurring = useMemo(() => recurringApi(getToken), [getToken]);
  return useQuery({
    queryKey: keys.recurring.list,
    queryFn: async () => {
      await ensureMaterialized(recurring);
      return recurring.list();
    },
  });
}
