/**
 * Runs before any module is imported by an integration test. Points the
 * server at the Neon test branch and refuses to run anywhere else: these
 * tests truncate tables.
 */
import 'dotenv/config';

const test = process.env.DATABASE_URL_TEST;
if (!test) {
  throw new Error('DATABASE_URL_TEST is not set. Create a Neon branch for tests and put its connection string in .env as DATABASE_URL_TEST.');
}
if (test === process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL_TEST is the same as DATABASE_URL. Integration tests must not run on the development database.');
}
process.env.DATABASE_URL = test;
process.env.DIRECT_URL = process.env.DIRECT_URL_TEST ?? test;
// Storage and AI are mocked; keep the env loader happy without real keys, and
// make storage count as configured so the purge paths run (CI has no AWS env).
process.env.TENSORX_API_KEY ??= 'test';
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';
process.env.S3_BUCKET ??= 'test-bucket';
process.env.S3_REGION ??= 'eu-central-1';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??= 'pk_test_placeholder';
