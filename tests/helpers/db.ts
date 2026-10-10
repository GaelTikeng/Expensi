import { sql } from 'drizzle-orm';

import { db } from '@/src/server/db/client';

/** Empties every user-data table on the test branch. Call in `beforeEach`. */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql`truncate table attachments, import_items, imports, planned_expenses, recurring_charges, recaps, ai_usage, expenses, categories, users cascade`,
  );
}

export { db };
