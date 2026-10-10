import { useAuth } from '@clerk/expo';
import { keepPreviousData, useInfiniteQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { errorMessage, invalidate, keys } from '@/src/lib/query';
import type { ExpenseDto, ExpenseListQuery } from '@/src/lib/schemas/expense';
import { expensesApi } from './api';

const PAGE = 50;

type Page = { items: ExpenseDto[]; nextOffset: number | null };
type Pages = { pages: Page[]; pageParams: unknown[] };

/** The row a list already holds, so a detail screen can open before its fetch returns. */
export function findCachedExpense(qc: QueryClient, id: string): ExpenseDto | undefined {
  for (const [, data] of qc.getQueriesData<Pages>({ queryKey: keys.expenses.all })) {
    for (const page of data?.pages ?? []) {
      const hit = page.items.find((e) => e.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

export type ExpensesFilter = Partial<Pick<ExpenseListQuery, 'q' | 'categoryId' | 'from' | 'to' | 'hasAttachment'>>;

/**
 * Paginated, searchable expense list on the shared cache (D15). While a new
 * search loads, the previous list stays visible. Deletion is optimistic and
 * rolls back on failure.
 */
export function useExpenses(filter: ExpensesFilter = {}) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => expensesApi(getToken), [getToken]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Serialise the filter so the key and the queryFn see the same value.
  const filterKey = JSON.stringify(filter);
  const queryKey = keys.expenses.list(JSON.parse(filterKey) as ExpensesFilter);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api.list({ ...(JSON.parse(filterKey) as ExpensesFilter), limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: ExpenseDto[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const e of page.items) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    }
    return out;
  }, [query.data]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const remove = useCallback(
    async (id: string) => {
      const previous = qc.getQueryData<Pages>(queryKey);
      qc.setQueryData<Pages>(queryKey, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((e) => e.id !== id) })) } : old,
      );
      try {
        await api.remove(id);
        setActionError(null);
        void invalidate.expenses(qc);
      } catch (err) {
        if (previous) qc.setQueryData(queryKey, previous);
        setActionError(errorMessage(err));
        throw err;
      }
    },
    // queryKey is derived from filterKey, which is the stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, qc, filterKey],
  );

  return {
    items,
    loading: query.isPending,
    loadingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    error: errorMessage(query.error) ?? actionError,
    refresh: () => query.refetch(),
    loadMore,
    remove,
    api,
  };
}
