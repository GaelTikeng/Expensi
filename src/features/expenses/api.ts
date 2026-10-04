import { apiFetch } from '@/src/lib/api';
import type { CategoryDto, CategoryInput, CategoryPatch } from '@/src/lib/schemas/category';
import type {
  ExpenseDto,
  ExpenseInput,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpensePatch,
} from '@/src/lib/schemas/expense';

type GetToken = () => Promise<string | null>;

function qs(params: Partial<ExpenseListQuery>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function expensesApi(getToken: GetToken) {
  return {
    list: (params: Partial<ExpenseListQuery> = {}) =>
      apiFetch<ExpenseListResponse>(`/api/expenses${qs(params)}`, getToken),
    get: (id: string) => apiFetch<ExpenseDto>(`/api/expenses/${id}`, getToken),
    create: (input: ExpenseInput) =>
      apiFetch<ExpenseDto>('/api/expenses', getToken, { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, patch: ExpensePatch) =>
      apiFetch<ExpenseDto>(`/api/expenses/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/api/expenses/${id}`, getToken, { method: 'DELETE' }),
  };
}

export function categoriesApi(getToken: GetToken) {
  return {
    list: () => apiFetch<{ items: CategoryDto[] }>('/api/categories', getToken).then((r) => r.items),
    create: (input: CategoryInput) =>
      apiFetch<CategoryDto>('/api/categories', getToken, { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, patch: CategoryPatch) =>
      apiFetch<CategoryDto>(`/api/categories/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/api/categories/${id}`, getToken, { method: 'DELETE' }),
  };
}
