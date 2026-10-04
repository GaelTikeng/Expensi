import * as FileSystem from 'expo-file-system/legacy';

import type { StagedFile } from './upload';
import { uploadStaged } from './upload';

type GetToken = () => Promise<string | null>;

export interface QueuedUpload {
  file: StagedFile;
  expenseId: string | null;
  attempts: number;
  lastError?: string;
  queuedAt: string;
}

const QUEUE_PATH = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}upload-queue.json`;
const MAX_ATTEMPTS = 8;

let memory: QueuedUpload[] | null = null;
let flushing = false;
const listeners = new Set<(q: QueuedUpload[]) => void>();

async function load(): Promise<QueuedUpload[]> {
  if (memory) return memory;
  try {
    const info = await FileSystem.getInfoAsync(QUEUE_PATH);
    memory = info.exists ? (JSON.parse(await FileSystem.readAsStringAsync(QUEUE_PATH)) as QueuedUpload[]) : [];
  } catch {
    memory = [];
  }
  return memory;
}

async function save(q: QueuedUpload[]) {
  memory = q;
  await FileSystem.writeAsStringAsync(QUEUE_PATH, JSON.stringify(q)).catch(() => undefined);
  for (const l of listeners) l(q);
}

export function subscribe(listener: (q: QueuedUpload[]) => void): () => void {
  listeners.add(listener);
  void load().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** F2b.7: park an upload that failed (offline, server down) for a later flush. */
export async function enqueue(file: StagedFile, expenseId: string | null, error?: unknown) {
  const q = await load();
  if (q.some((e) => e.file.attachmentId === file.attachmentId)) return;
  await save([
    ...q,
    {
      file,
      expenseId,
      attempts: 0,
      lastError: error instanceof Error ? error.message : undefined,
      queuedAt: new Date().toISOString(),
    },
  ]);
}

export async function pendingForExpense(expenseId: string): Promise<QueuedUpload[]> {
  return (await load()).filter((e) => e.expenseId === expenseId);
}

/**
 * Retries everything in the queue once, in order. Called on app foreground and
 * when the expenses tab gains focus. Entries that exceed MAX_ATTEMPTS are
 * dropped so a corrupt file cannot wedge the queue forever.
 */
export async function flush(getToken: GetToken): Promise<{ uploaded: number; remaining: number }> {
  if (flushing) return { uploaded: 0, remaining: (await load()).length };
  flushing = true;
  let uploaded = 0;
  try {
    const q = await load();
    const remaining: QueuedUpload[] = [];
    for (const entry of q) {
      try {
        await uploadStaged(entry.file, { expenseId: entry.expenseId, getToken });
        uploaded++;
      } catch (err) {
        const attempts = entry.attempts + 1;
        if (attempts < MAX_ATTEMPTS) {
          remaining.push({ ...entry, attempts, lastError: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    await save(remaining);
    return { uploaded, remaining: remaining.length };
  } finally {
    flushing = false;
  }
}
