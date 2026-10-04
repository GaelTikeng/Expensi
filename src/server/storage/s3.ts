import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../env';
import { HttpError } from '../errors';

/**
 * Proof files and import uploads live in one private bucket (CLAUDE.md D12).
 * The device talks to S3 only through short-lived presigned URLs minted here.
 * The database stores object keys, never URLs.
 */
let client: S3Client | null = null;

/** Lazily built so the server boots without S3 configured (F0.12 pending). */
function s3(): S3Client {
  if (client) return client;
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.S3_BUCKET || !env.S3_REGION) {
    throw new HttpError(503, 'storage_not_configured', 'File storage is not configured yet (S3 env vars missing).');
  }
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  });
  return client;
}

function bucket(): string {
  if (!env.S3_BUCKET) throw new HttpError(503, 'storage_not_configured', 'File storage is not configured yet (S3 env vars missing).');
  return env.S3_BUCKET;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/pdf',
]);

export const ALLOWED_IMPORT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/pdf',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
};

/** `users/{userId}/{yyyy}/{mm}/{id}.{ext}` — a per-user purge is one prefix delete. */
export function buildObjectKey(userId: string, id: string, mimeType: string, now = new Date()) {
  const ext = EXT_BY_MIME[mimeType] ?? 'bin';
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `users/${userId}/${yyyy}/${mm}/${id}.${ext}`;
}

export function userPrefix(userId: string) {
  return `users/${userId}/`;
}

/** Presigned PUT constrained to the declared type and size. Default TTL 10 min. */
export async function presignPut(input: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}): Promise<{ url: string; expiresAt: Date }> {
  const expiresIn = input.expiresInSeconds ?? 600;
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
    { expiresIn },
  );
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

/** Presigned GET. Capped at 15 minutes (CLAUDE.md convention 11). */
export async function presignGet(key: string, expiresInSeconds = 900): Promise<string> {
  const expiresIn = Math.min(expiresInSeconds, 900);
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

/** Confirms an upload landed and reports what S3 actually stored. */
export async function headObject(key: string) {
  const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  return {
    contentType: res.ContentType ?? null,
    contentLength: res.ContentLength ?? null,
    etag: res.ETag ?? null,
  };
}

/** Downloads a whole object into memory (imports are capped at 10 MB). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty object: ${key}`);
  return Buffer.from(bytes);
}

/** `users/{userId}/imports/{id}.{ext}` — kept apart from proof attachments. */
export function buildImportKey(userId: string, id: string, mimeType: string) {
  const ext = EXT_BY_MIME[mimeType] ?? 'bin';
  return `users/${userId}/imports/${id}.${ext}`;
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Deletes everything under a prefix (used for account deletion). */
export async function deletePrefix(prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await s3().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length > 0) {
      await s3().send(
        new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys, Quiet: true } }),
      );
      deleted += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
