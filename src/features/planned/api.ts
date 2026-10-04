import { apiFetch } from '@/src/lib/api';
import type { PlannedComplete, PlannedDto, PlannedInput, PlannedListQuery, PlannedMonthSummary, PlannedPatch } from '@/src/lib/schemas/planned';
import type { RecurringDto, RecurringInput, RecurringPatch } from '@/src/lib/schemas/recurring';

type GetToken = () => Promise<string | null>;

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function plannedApi(getToken: GetToken) {
  return {
    list: (q: Partial<PlannedListQuery> = {}) =>
      apiFetch<{ items: PlannedDto[]; nextOffset: number | null }>(`/api/planned${qs(q)}`, getToken),
    get: (id: string) => apiFetch<PlannedDto>(`/api/planned/${id}`, getToken),
    create: (input: PlannedInput) => apiFetch<PlannedDto>('/api/planned', getToken, { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, patch: PlannedPatch) =>
      apiFetch<PlannedDto>(`/api/planned/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(patch) }),
    complete: (id: string, input: PlannedComplete = {}) =>
      apiFetch<{ planned: PlannedDto; expenseId: string }>(`/api/planned/${id}/complete`, getToken, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/api/planned/${id}`, getToken, { method: 'DELETE' }),
    summary: (year: number) => apiFetch<{ year: number; months: PlannedMonthSummary[] }>(`/api/planned/summary?year=${year}`, getToken),
  };
}

export function recurringApi(getToken: GetToken) {
  return {
    list: () => apiFetch<{ periodStart: string; items: RecurringDto[] }>('/api/recurring', getToken),
    create: (input: RecurringInput) => apiFetch<RecurringDto>('/api/recurring', getToken, { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, patch: RecurringPatch) =>
      apiFetch<RecurringDto>(`/api/recurring/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/api/recurring/${id}`, getToken, { method: 'DELETE' }),
    materialize: () => apiFetch<{ created: PlannedDto[] }>('/api/recurring/materialize', getToken, { method: 'POST' }),
  };
}
