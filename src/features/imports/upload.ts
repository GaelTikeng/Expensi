import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { putWithRetry } from '@/src/features/attachments/upload';
import { newId } from '@/src/features/expenses/ids';
import { IMPORT_MIME_TYPES, MAX_IMPORT_BYTES, type ImportDto, type ImportMime } from '@/src/lib/schemas/import';
import { importsApi } from './api';

type GetToken = () => Promise<string | null>;

export interface PickedImport {
  uri: string;
  name: string;
  mimeType: ImportMime;
  sizeBytes: number;
}

const EXT_MIME: Record<string, ImportMime> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  pdf: 'application/pdf',
};

/** F3.4: pick one .xlsx / .xls / .csv / .pdf. Normalises the MIME from the extension when the OS is vague. */
export async function pickImportFile(): Promise<PickedImport | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [...IMPORT_MIME_TYPES, 'application/octet-stream'],
    multiple: false,
    // Android: keep the content:// reference. The picker's own copy lands in
    // the host app's cache, which Expo Go does not let this project read
    // ("isn't readable"); a content:// URI is readable and we stage it
    // ourselves. iOS needs the copy, since the picked URL is only valid while
    // the picker is open.
    copyToCacheDirectory: Platform.OS !== 'android',
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const ext = a.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = (IMPORT_MIME_TYPES as readonly string[]).includes(a.mimeType ?? '')
    ? (a.mimeType as ImportMime)
    : EXT_MIME[ext];
  if (!mimeType) throw new Error('Choose an Excel, CSV or PDF file');

  let sizeBytes = a.size ?? 0;
  if (!sizeBytes) {
    const info = await FileSystem.getInfoAsync(a.uri);
    sizeBytes = info.exists && 'size' in info ? info.size : 0;
  }
  if (sizeBytes <= 0) throw new Error('Could not read the file');
  if (sizeBytes > MAX_IMPORT_BYTES) throw new Error('File is larger than 10 MB');
  return { uri: a.uri, name: a.name, mimeType, sizeBytes };
}

const STAGE_DIR = `${FileSystem.cacheDirectory}imports/`;

/**
 * Copy the picked file into this project's own cache, as attachments do, so
 * the upload task reads a path it is allowed to read (content:// on Android,
 * the picker's copy on iOS).
 */
async function stageForUpload(file: PickedImport, id: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(STAGE_DIR, { intermediates: true }).catch(() => undefined);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const dest = `${STAGE_DIR}${id}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: file.uri, to: dest });
  } catch (err) {
    throw new Error(`Could not read the chosen file (${err instanceof Error ? err.message : String(err)})`);
  }
  return dest;
}

/** Presign → PUT → register. Returns the new import row (status `queued`). */
export async function uploadImportFile(
  file: PickedImport,
  getToken: GetToken,
  onProgress?: (fraction: number) => void,
): Promise<ImportDto> {
  const api = importsApi(getToken);
  const id = newId();
  const staged = await stageForUpload(file, id);
  try {
    const presigned = await api.presign({ id, mimeType: file.mimeType, sizeBytes: file.sizeBytes, originalFilename: file.name });
    await putWithRetry(presigned.uploadUrl, { uri: staged, mimeType: file.mimeType }, onProgress);
    return await api.create({ id, storageKey: presigned.key, mimeType: file.mimeType, sizeBytes: file.sizeBytes, originalFilename: file.name });
  } finally {
    // The server has the bytes (or the upload failed); either way the copy is no longer needed.
    void FileSystem.deleteAsync(staged, { idempotent: true }).catch(() => undefined);
  }
}
