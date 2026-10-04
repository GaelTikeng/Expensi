import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CategoryDto } from '@/src/lib/schemas/category';
import { categoriesApi } from './api';

export function useCategories() {
  const { getToken } = useAuth();
  const api = useMemo(() => categoriesApi(getToken), [getToken]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .list()
      .then((items) => {
        if (!cancelled) setCategories(items);
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
  }, [api]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await api.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return { categories, byId, loading, error, reload, api };
}
