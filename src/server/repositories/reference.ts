import { asc, eq } from 'drizzle-orm';

import type { Db } from '../db/client';
import { currencies } from '../db/schema';

/** Reference data shared by all users; intentionally not user-scoped. */
export class ReferenceRepository {
  constructor(private readonly db: Db) {}

  listCurrencies() {
    return this.db.select().from(currencies).orderBy(asc(currencies.code));
  }

  async currencyExists(code: string): Promise<boolean> {
    const rows = await this.db
      .select({ code: currencies.code })
      .from(currencies)
      .where(eq(currencies.code, code))
      .limit(1);
    return rows.length > 0;
  }
}
