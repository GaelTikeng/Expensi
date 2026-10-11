import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { putWithRetry } from '@/src/features/attachments/upload';
import type { LocalFile } from '@/src/features/attachments/pick';
import { apiFetch } from '@/src/lib/api';
import { MAX_AVATAR_BYTES, type AvatarPresignResponse } from '@/src/lib/schemas/profile';
import { t } from '@/src/i18n';

type GetToken = () => Promise<string | null>;

const AVATAR_SIZE = 512;
const JPEG_QUALITY = 0.85;

/**
 * E15 F15.2: resize the picked image to 512 px, upload it with a presigned
 * PUT, and return the storage key for `PATCH /api/me { avatarKey }`.
 */
export async function uploadAvatar(file: LocalFile, getToken: GetToken): Promise<string> {
  const ctx = ImageManipulator.manipulate(file.uri);
  ctx.resize({ width: AVATAR_SIZE });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  const info = await FileSystem.getInfoAsync(out.uri);
  const sizeBytes = info.exists && 'size' in info ? info.size : 0;
  if (sizeBytes <= 0) throw new Error(t('avatar.unreadable'));
  if (sizeBytes > MAX_AVATAR_BYTES) throw new Error(t('avatar.tooLarge'));

  const presigned = await apiFetch<AvatarPresignResponse>('/api/me/avatar', getToken, { method: 'POST', body: JSON.stringify({ sizeBytes }) });
  await putWithRetry(presigned.uploadUrl, { uri: out.uri, mimeType: 'image/jpeg' });
  void FileSystem.deleteAsync(out.uri, { idempotent: true }).catch(() => undefined);
  return presigned.key;
}
