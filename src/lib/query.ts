import { focusManager, QueryClient, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Client data cache (D15). Every screen reads through TanStack Query, so data
 * fetched once is shown instantly on the next visit and refreshed in the
 * background. Skeletons appear only when nothing is cached yet.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Reference data that changes rarely: profile, categories. */
export const REFERENCE_STALE = 10 * 60_000;

// TanStack's recommended React Native setup: treat "app in foreground" as
// window focus so stale queries refresh when the user comes back to the app.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

/**
 * Query keys, hierarchical so one `invalidateQueries` can hit a whole family
 * (`keys.expenses.all` covers every list and every detail).
 */
export const keys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  usage: ['usage'] as const,
  expenses: {
    all: ['expenses'] as const,
    list: (filter: object) => ['expenses', 'list', filter] as const,
    detail: (id: string) => ['expenses', 'detail', id] as const,
  },
  recaps: {
    all: ['recaps'] as const,
    one: (period: string, start: string) => ['recaps', period, start] as const,
    overview: ['recaps', 'overview'] as const,
  },
  planned: {
    all: ['planned'] as const,
    upcoming: ['planned', 'upcoming'] as const,
    detail: (id: string) => ['planned', 'detail', id] as const,
    summary: (year: number) => ['planned', 'summary', year] as const,
    month: (month: string) => ['planned', 'month', month] as const,
  },
  recurring: {
    all: ['recurring'] as const,
    list: ['recurring', 'list'] as const,
  },
  imports: {
    all: ['imports'] as const,
    list: ['imports', 'list'] as const,
    detail: (id: string) => ['imports', 'detail', id] as const,
  },
  attachments: (expenseId: string) => ['attachments', expenseId] as const,
};

/**
 * What to mark stale after each kind of change. Marked queries refetch in the
 * background when their screen is next shown; nothing flashes a skeleton.
 */
export const invalidate = {
  /** Expense created, edited, deleted or imported: lists, details, recaps, home tiles. */
  expenses: (qc: QueryClient) =>
    Promise.all([qc.invalidateQueries({ queryKey: keys.expenses.all }), qc.invalidateQueries({ queryKey: keys.recaps.all })]),
  /** Plan created, edited, completed, skipped or deleted; fixed charge changed. */
  plans: (qc: QueryClient) =>
    Promise.all([qc.invalidateQueries({ queryKey: keys.planned.all }), qc.invalidateQueries({ queryKey: keys.recurring.all })]),
  imports: (qc: QueryClient) => qc.invalidateQueries({ queryKey: keys.imports.all }),
  /** Proof added or removed: the strip and the paperclip counts in lists. */
  attachments: (qc: QueryClient, expenseId: string) =>
    Promise.all([qc.invalidateQueries({ queryKey: keys.attachments(expenseId) }), qc.invalidateQueries({ queryKey: keys.expenses.all })]),
};

/**
 * Tab screens stay mounted, so `refetchOnMount` never fires for them. This
 * refreshes a query family in the background when the screen regains focus,
 * and only if it has gone stale, so hopping between tabs costs nothing.
 */
export function useRefetchOnFocus(queryKey: readonly unknown[]) {
  const qc = useQueryClient();
  const first = useRef(true);
  const serialised = JSON.stringify(queryKey);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void qc.invalidateQueries({ queryKey: JSON.parse(serialised) as unknown[], stale: true });
    }, [qc, serialised]),
  );
}

export function errorMessage(err: unknown): string | null {
  if (!err) return null;
  return err instanceof Error ? err.message : String(err);
}
