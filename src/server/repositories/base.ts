import type { Db } from '../db/client';

/**
 * Every repository is constructed for exactly one user. There is no RLS; this
 * class is the trust boundary (CLAUDE.md D3). An unscoped query must be
 * impossible to express: never accept a userId as a method argument, never
 * expose `db` publicly.
 */
export abstract class UserScopedRepository {
  protected readonly db: Db;
  protected readonly userId: string;

  constructor(db: Db, userId: string) {
    if (!userId) throw new Error('UserScopedRepository requires a userId');
    this.db = db;
    this.userId = userId;
  }
}
