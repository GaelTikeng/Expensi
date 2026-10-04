import { apiFetch } from '@/src/lib/api';
import type { AttachmentDto, ConfirmRequest, PresignRequest, PresignResponse } from '@/src/lib/schemas/attachment';

type GetToken = () => Promise<string | null>;

export function attachmentsApi(getToken: GetToken) {
  return {
    presign: (input: PresignRequest) =>
      apiFetch<PresignResponse>('/api/attachments/presign', getToken, { method: 'POST', body: JSON.stringify(input) }),
    confirm: (input: ConfirmRequest) =>
      apiFetch<AttachmentDto>('/api/attachments', getToken, { method: 'POST', body: JSON.stringify(input) }),
    listForExpense: (expenseId: string) =>
      apiFetch<{ items: AttachmentDto[] }>(`/api/attachments?expenseId=${expenseId}`, getToken).then((r) => r.items),
    url: (id: string) =>
      apiFetch<{ url: string; expiresAt: string; mimeType: string; kind: 'photo' | 'pdf' }>(
        `/api/attachments/${id}/url`,
        getToken,
      ),
    remove: (id: string) => apiFetch<{ ok: true }>(`/api/attachments/${id}`, getToken, { method: 'DELETE' }),
  };
}
