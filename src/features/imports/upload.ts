import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

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
    copyToCacheDirectory: true,
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

/** Presign → PUT → register. Returns the new import row (status `queued`). */
export async function uploadImportFile(
  file: PickedImport,
  getToken: GetToken,
  onProgress?: (fraction: number) => void,
): Promise<ImportDto> {
  const api = importsApi(getToken);
  const id = newId();
  const presigned = await api.presign({ id, mimeType: file.mimeType, sizeBytes: file.sizeBytes, originalFilename: file.name });
  await putWithRetry(presigned.uploadUrl, { uri: file.uri, mimeType: file.mimeType }, onProgress);
  return api.create({ id, storageKey: presigned.key, mimeType: file.mimeType, sizeBytes: file.sizeBytes, originalFilename: file.name });
}
