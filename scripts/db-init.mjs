/**
 * One-time database preparation, run against the DIRECT (non-pooler) URL:
 *
 *   node --env-file=.env scripts/db-init.mjs
 *
 * Enables pgcrypto (gen_random_uuid) and prints the server version. Follow
 * with `pnpm db:migrate` and `pnpm db:seed`.
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DIRECT_URL is not set');
  process.exit(2);
}
const sql = neon(url);
await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
const [v] = await sql`select version()`;
console.log('connected:', v.version.split(' ').slice(0, 2).join(' '));
