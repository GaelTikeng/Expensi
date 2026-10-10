import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { errorMessage, invalidate, keys } from '@/src/lib/query';
import type { AttachmentDto } from '@/src/lib/schemas/attachment';
import { attachmentsApi } from './api';
import type { LocalFile } from './pick';
import { enqueue, pendingForExpense, subscribe, type QueuedUpload } from './queue';
import { stageFile, uploadStaged, type StagedFile } from './upload';

export interface UploadingEntry {
  file: StagedFile;
  progress: number;
}

const EMPTY: AttachmentDto[] = [];

/**
 * Attachments of an existing expense: cached server list (D15) + in-flight
 * uploads + parked (offline) uploads, so the strip reflects every state.
 * View URLs are presigned for 15 min, so the list goes stale after 5.
 */
export function useAttachments(expenseId: string) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => attachmentsApi(getToken), [getToken]);
  const queryKey = keys.attachments(expenseId);

  const query = useQuery({ queryKey, queryFn: () => api.listForExpense(expenseId), staleTime: 5 * 60_000 });
  const items = query.data ?? EMPTY;

  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const [queued, setQueued] = useState<QueuedUpload[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pendingForExpense(expenseId)
      .then((pending) => {
        if (!cancelled) setQueued(pending);
      })
      .catch(() => undefined);
    const unsub = subscribe((q) => {
      if (!cancelled) setQueued(q.filter((e) => e.expenseId === expenseId));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [expenseId]);

  const add = useCallback(
    async (files: LocalFile[]) => {
      for (const f of files) {
        let staged: StagedFile;
        try {
          staged = await stageFile(f);
        } catch (err) {
          setActionError(errorMessage(err));
          continue;
        }
        setUploading((u) => [...u, { file: staged, progress: 0 }]);
        try {
          const saved = await uploadStaged(staged, {
            expenseId,
            getToken,
            onProgress: (p) =>
              setUploading((u) => u.map((e) => (e.file.attachmentId === staged.attachmentId ? { ...e, progress: p } : e))),
          });
          qc.setQueryData<AttachmentDto[]>(queryKey, (prev) => [saved, ...(prev ?? [])]);
          // The list response carries view URLs; refetch to get one for the new file.
          void invalidate.attachments(qc, expenseId);
        } catch (err) {
          await enqueue(staged, expenseId, err);
        } finally {
          setUploading((u) => u.filter((e) => e.file.attachmentId !== staged.attachmentId));
        }
      }
    },
    // queryKey derives from expenseId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenseId, getToken, qc],
  );

  const remove = useCallback(
    async (id: string) => {
      const previous = qc.getQueryData<AttachmentDto[]>(queryKey);
      qc.setQueryData<AttachmentDto[]>(queryKey, (prev) => (prev ?? []).filter((a) => a.id !== id));
      try {
        await api.remove(id);
        setActionError(null);
        void qc.invalidateQueries({ queryKey: keys.expenses.all });
      } catch (err) {
        if (previous) qc.setQueryData(queryKey, previous);
        setActionError(errorMessage(err));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, qc, expenseId],
  );

  return {
    items,
    uploading,
    queued,
    loading: query.isPending,
    error: errorMessage(query.error) ?? actionError,
    add,
    remove,
    reload: () => query.refetch(),
    api,
  };
}
