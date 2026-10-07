import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AttachmentDto } from '@/src/lib/schemas/attachment';
import { attachmentsApi } from './api';
import type { LocalFile } from './pick';
import { enqueue, pendingForExpense, subscribe, type QueuedUpload } from './queue';
import { stageFile, uploadStaged, type StagedFile } from './upload';

export interface UploadingEntry {
  file: StagedFile;
  progress: number;
}

/**
 * Attachments of an existing expense: server list + in-flight uploads +
 * parked (offline) uploads, so the strip reflects every state.
 */
export function useAttachments(expenseId: string) {
  const { getToken } = useAuth();
  const api = useMemo(() => attachmentsApi(getToken), [getToken]);

  const [items, setItems] = useState<AttachmentDto[]>([]);
  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const [queued, setQueued] = useState<QueuedUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await api.listForExpense(expenseId));
      setQueued(await pendingForExpense(expenseId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [api, expenseId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listForExpense(expenseId), pendingForExpense(expenseId)])
      .then(([list, pending]) => {
        if (cancelled) return;
        setItems(list);
        setQueued(pending);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsub = subscribe((q) => {
      if (!cancelled) setQueued(q.filter((e) => e.expenseId === expenseId));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [api, expenseId]);

  const add = useCallback(
    async (files: LocalFile[]) => {
      for (const f of files) {
        let staged: StagedFile;
        try {
          staged = await stageFile(f);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
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
          setItems((prev) => [saved, ...prev]);
          // The list response carries view URLs; refresh to get one for the new file.
          void api.listForExpense(expenseId).then(setItems).catch(() => undefined);
        } catch (err) {
          await enqueue(staged, expenseId, err);
        } finally {
          setUploading((u) => u.filter((e) => e.file.attachmentId !== staged.attachmentId));
        }
      }
    },
    [api, expenseId, getToken],
  );

  const remove = useCallback(
    async (id: string) => {
      const previous = items;
      setItems((prev) => prev.filter((a) => a.id !== id));
      try {
        await api.remove(id);
      } catch (err) {
        setItems(previous);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, items],
  );

  return { items, uploading, queued, loading, error, add, remove, reload, api };
}
