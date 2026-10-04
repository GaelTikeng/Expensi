import { z } from 'zod';

/**
 * Server-only environment. Parsed once at import; a missing variable fails
 * fast at boot instead of on the first request that needs it.
 *
 * Client code must never import this module (ESLint enforces it).
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  /** Direct (non-pooler) URL, used only by drizzle-kit migrate. */
  DIRECT_URL: z.string().url().optional(),

  CLERK_SECRET_KEY: z.string().min(1),

  TENSORX_API_KEY: z.string().min(1),
  TENSORX_BASE_URL: z.string().url().default('https://api.tensorx.ai/v1'),
  /** Override model ids without a code change. Verify against GET /v1/models. */
  TENSORX_MODEL_EXTRACT: z.string().default('z-ai/glm-5.3-flash'),
  TENSORX_MODEL_NARRATIVE: z.string().default('z-ai/glm-5.3'),

  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  /** For S3-compatible providers (MinIO, R2). Leave unset for AWS. */
  S3_ENDPOINT: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid server environment:\n${missing.join('\n')}`);
  }
  return parsed.data;
}

export const env: Env = load();
