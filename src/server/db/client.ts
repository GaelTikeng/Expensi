import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { env } from '../env';
import * as schema from './schema';

/**
 * neon-http: one HTTP round trip per query, no persistent connection. Correct
 * for serverless API routes — a pooled TCP driver across many cold instances
 * exhausts Neon's connection limit.
 *
 * Tradeoff: no interactive transactions over HTTP. For multi-statement atomic
 * work (promoting import_items -> expenses) use db.batch([...]).
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
export type Db = typeof db;
