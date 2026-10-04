import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Migrations run against the DIRECT (non-pooler) Neon URL; DDL through the
 * pooler can hang on advisory locks. Runtime queries use DATABASE_URL.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '' },
  verbose: true,
  strict: true,
});
