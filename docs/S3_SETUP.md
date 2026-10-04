# S3 bucket setup (F0.12)

One private bucket holds proof attachments and import uploads. The app never
receives AWS credentials; it uploads and downloads through presigned URLs minted
by the API routes (`src/server/storage/s3.ts`).

## 1. Bucket

- Name: `expense-app-files` (or set `S3_BUCKET`), region `eu-central-1` to sit
  next to Neon.
- **Block all public access: on.** Objects are only ever reached via presigned URLs.
- Versioning: off (soft delete lives in the database).
- Default encryption: SSE-S3.

## 2. Lifecycle rule — orphaned uploads

A client may get a presigned PUT, upload, and never call confirm. Expire those:

- Rule: `expire-unconfirmed`
- Filter: tag `confirmed != true` is not possible on PUT without the client
  setting it, so instead the API moves nothing and we rely on a sweep job
  (E2b.7) comparing `attachments.uploaded_at IS NULL` rows older than 24h and
  deleting their keys. Until that job exists, add a simple rule:
  *Expire current versions after 1 day* on the prefix `tmp/` and have presign
  write under `tmp/` until confirm copies it — **not implemented in v0.1**;
  keys go directly under `users/`. Revisit when E2b.7 lands.

## 3. CORS (needed for presigned PUT from the app)

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Tighten `AllowedOrigins` to the EAS Hosting origin once it exists.

## 4. IAM user for the API

Programmatic access only. Attach this inline policy, scoped to the one bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::expense-app-files/users/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::expense-app-files",
      "Condition": { "StringLike": { "s3:prefix": ["users/*"] } }
    }
  ]
}
```

Put the access key pair in the server env as `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY`.

## 5. S3-compatible alternatives

Cloudflare R2 or MinIO work unchanged: set `S3_ENDPOINT` and the client switches
to path-style addressing.
