import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { CategoryDto } from '@/src/lib/schemas/category';
import { errorMessage, keys, REFERENCE_STALE } from '@/src/lib/query';
import { categoriesApi } from './api';

const EMPTY: CategoryDto[] = [];

/** The user's categories, cached for the session (D15); forms open without waiting. */
export function useCategories() {
  const { getToken } = useAuth();
  const api = useMemo(() => categoriesApi(getToken), [getToken]);

  const query = useQuery({
    queryKey: keys.categories,
    queryFn: () => api.list(),
    staleTime: REFERENCE_STALE,
  });

  const categories = query.data ?? EMPTY;
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return { categories, byId, loading: query.isPending, error: errorMessage(query.error), reload: () => query.refetch(), api };
}
