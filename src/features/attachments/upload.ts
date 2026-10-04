import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { newId } from '@/src/features/expenses/ids';
import { MAX_ATTACHMENT_BYTES, type AttachmentDto, type AttachmentMime } from '@/src/lib/schemas/attachment';
import { attachmentsApi } from './api';
import type { LocalFile } from './pick';

type GetToken = () => Promise<string | null>;

const MAX_IMAGE_WIDTH = 1600;
const JPEG_QUALITY = 0.8;
const LOCAL_DIR = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}attachments/`;

/** A file staged in app storage, ready to upload (survives app restarts). */
export interface StagedFile extends LocalFile {
  attachmentId: string;
  mimeType: AttachmentMime;
  sizeBytes: number;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(LOCAL_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true });
}

/**
 * Compresses images (max 1600px wide, JPEG 0.8), copies the result into app
 * storage under the attachment id, and measures it. Pickers return cache URIs
 * the OS may evict; staging makes a queued retry safe.
 */
export async function stageFile(file: LocalFile): Promise<StagedFile> {
  await ensureDir();
  const attachmentId = newId();

  let uri = file.uri;
  let mimeType: AttachmentMime = file.mimeType as AttachmentMime;

  if (file.kind === 'photo') {
    const ctx = ImageManipulator.manipulate(file.uri);
    ctx.resize({ width: MAX_IMAGE_WIDTH });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    uri = out.uri;
    mimeType = 'image/jpeg';
  }

  const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
  const dest = `${LOCAL_DIR}${attachmentId}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  const info = await FileSystem.getInfoAsync(dest);
  const sizeBytes = info.exists && 'size' in info ? info.size : 0;
  if (sizeBytes <= 0) throw new Error('Could not read the file');
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error('File is larger than 10 MB');
  }

  return { ...file, uri: dest, mimeType, sizeBytes, attachmentId, name: file.name.replace(/\.[^.]+$/, '') + `.${ext}` };
}

export async function discardStaged(file: Pick<StagedFile, 'uri'>) {
  await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => undefined);
}

async function putWithRetry(
  url: string,
  file: StagedFile,
  onProgress?: (fraction: number) => void,
  attempts = 3,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const task = FileSystem.createUploadTask(
        url,
        file.uri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { 'content-type': file.mimeType },
        },
        (p) => onProgress?.(p.totalBytesExpectedToSend > 0 ? p.totalBytesSent / p.totalBytesExpectedToSend : 0),
      );
      const res = await task.uploadAsync();
      if (res && res.status >= 200 && res.status < 300) return;
      lastErr = new Error(`Storage rejected the upload (${res?.status ?? 'no response'})`);
      if (res && res.status >= 400 && res.status < 500) break; // not retryable
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed');
}

/**
 * Presign → PUT → confirm (CLAUDE.md D12). Throws on failure; the caller
 * decides whether to queue the staged file for a later retry.
 */
export async function uploadStaged(
  file: StagedFile,
  opts: { expenseId: string | null; getToken: GetToken; onProgress?: (fraction: number) => void },
): Promise<AttachmentDto> {
  const api = attachmentsApi(opts.getToken);
  const presigned = await api.presign({
    id: file.attachmentId,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    originalFilename: file.name,
    expenseId: opts.expenseId ?? undefined,
  });
  await putWithRetry(presigned.uploadUrl, file, opts.onProgress);
  const confirmed = await api.confirm({ id: file.attachmentId, expenseId: opts.expenseId });
  await discardStaged(file);
  return confirmed;
}
