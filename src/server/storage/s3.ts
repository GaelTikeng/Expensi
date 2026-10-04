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

/**
 * Proof files and import uploads live in one private bucket (CLAUDE.md D12).
 * The device talks to S3 only through short-lived presigned URLs minted here.
 * The database stores object keys, never URLs.
 */
export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: Boolean(env.S3_ENDPOINT),
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = env.S3_BUCKET;

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
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
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
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

/** Confirms an upload landed and reports what S3 actually stored. */
export async function headObject(key: string) {
  const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return {
    contentType: res.ContentType ?? null,
    contentLength: res.ContentLength ?? null,
    etag: res.ETag ?? null,
  };
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Deletes everything under a prefix (used for account deletion). */
export async function deletePrefix(prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys, Quiet: true } }),
      );
      deleted += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
