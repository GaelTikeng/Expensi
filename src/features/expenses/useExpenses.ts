import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ExpenseDto, ExpenseListQuery } from '@/src/lib/schemas/expense';
import { expensesApi } from './api';

const PAGE = 50;

/**
 * Paginated, searchable expense list. Mutations update the local list
 * optimistically and roll back on failure.
 */
export type ExpensesFilter = Partial<Pick<ExpenseListQuery, 'q' | 'categoryId' | 'from' | 'to' | 'hasAttachment'>>;

export function useExpenses(filter: ExpensesFilter = {}) {
  const { getToken } = useAuth();
  const api = useMemo(() => expensesApi(getToken), [getToken]);

  const [items, setItems] = useState<ExpenseDto[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Serialise the filter so effect deps are stable across re-renders.
  const filterKey = JSON.stringify(filter);
  const requestSeq = useRef(0);

  const fetchPage = useCallback(
    async (offset: number): Promise<{ items: ExpenseDto[]; nextOffset: number | null }> => {
      const f = JSON.parse(filterKey) as typeof filter;
      return api.list({ ...f, limit: PAGE, offset });
    },
    [api, filterKey],
  );

  // Initial load and reload when the filter changes. Later responses from a
  // superseded request are ignored.
  useEffect(() => {
    const seq = ++requestSeq.current;
    fetchPage(0)
      .then((page) => {
        if (seq !== requestSeq.current) return;
        setItems(page.items);
        setNextOffset(page.nextOffset);
        setError(null);
      })
      .catch((err: unknown) => {
        if (seq === requestSeq.current) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const page = await fetchPage(0);
      if (seq !== requestSeq.current) return;
      setItems(page.items);
      setNextOffset(page.nextOffset);
      setError(null);
    } catch (err) {
      if (seq === requestSeq.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextOffset);
      setItems((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...page.items.filter((e) => !seen.has(e.id))];
      });
      setNextOffset(page.nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, nextOffset, loadingMore]);

  const remove = useCallback(
    async (id: string) => {
      const previous = items;
      setItems((prev) => prev.filter((e) => e.id !== id));
      try {
        await api.remove(id);
      } catch (err) {
        setItems(previous);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [api, items],
  );

  return {
    items,
    loading,
    loadingMore,
    hasMore: nextOffset !== null,
    error,
    refresh,
    loadMore,
    remove,
    api,
  };
}
