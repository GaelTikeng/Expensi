import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { EXPORT_MIME, exportFilename, type ExportFormat } from '@/src/lib/schemas/export';
import { exportUrl, type ExportRange } from './api';

type GetToken = () => Promise<string | null>;

const UTI: Record<ExportFormat, string> = { pdf: 'com.adobe.pdf', xlsx: 'org.openxmlformats.spreadsheetml.sheet' };

function messageFrom(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? `Export failed (${status})`;
  } catch {
    return `Export failed (${status})`;
  }
}

/**
 * E10 F10.5: fetch the file with the session token. Web triggers a browser
 * download; native saves to the app cache and opens the share sheet so the
 * user can keep it in Files, Drive, mail or WhatsApp.
 */
export async function downloadExport(range: ExportRange, format: ExportFormat, getToken: GetToken): Promise<void> {
  const token = await getToken();
  const url = exportUrl(range, format);
  const filename = exportFilename(range.from, range.to, format);
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};

  if (Platform.OS === 'web') {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(messageFrom(res.status, await res.text().catch(() => '')));
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return;
  }

  const dir = `${FileSystem.cacheDirectory}exports/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const dest = `${dir}${filename}`;
  const res = await FileSystem.downloadAsync(url, dest, { headers });
  if (res.status !== 200) {
    const body = await FileSystem.readAsStringAsync(dest).catch(() => '');
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
    throw new Error(messageFrom(res.status, body));
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(dest, { mimeType: EXPORT_MIME[format], dialogTitle: filename, UTI: UTI[format] });
}
