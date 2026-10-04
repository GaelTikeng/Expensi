import { apiFetch } from '@/src/lib/api';
import type { ImportCreate, ImportDetailResponse, ImportDto, ImportItemDto, ImportItemPatch } from '@/src/lib/schemas/import';

type GetToken = () => Promise<string | null>;

export function importsApi(getToken: GetToken) {
  return {
    presign: (input: { id: string; mimeType: string; sizeBytes: number; originalFilename?: string }) =>
      apiFetch<{ id: string; key: string; uploadUrl: string; expiresAt: string }>('/api/imports/presign', getToken, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    create: (input: ImportCreate) =>
      apiFetch<ImportDto>('/api/imports', getToken, { method: 'POST', body: JSON.stringify(input) }),
    list: (offset = 0) =>
      apiFetch<{ items: ImportDto[]; nextOffset: number | null }>(`/api/imports?offset=${offset}`, getToken),
    get: (id: string) => apiFetch<ImportDetailResponse>(`/api/imports/${id}`, getToken),
    process: (id: string) => apiFetch<ImportDetailResponse>(`/api/imports/${id}/process`, getToken, { method: 'POST' }),
    patchItem: (id: string, itemId: string, patch: ImportItemPatch) =>
      apiFetch<ImportItemDto>(`/api/imports/${id}/items/${itemId}`, getToken, { method: 'PATCH', body: JSON.stringify(patch) }),
    commit: (id: string, acceptedItemIds: string[]) =>
      apiFetch<{ created: number; expenseIds: string[] }>(`/api/imports/${id}/commit`, getToken, {
        method: 'POST',
        body: JSON.stringify({ acceptedItemIds }),
      }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/api/imports/${id}`, getToken, { method: 'DELETE' }),
  };
}
