import type { Db } from '../db/client';
import { ExpensesRepository } from './expenses';

export { UsersRepository } from './users';
export { ExpensesRepository } from './expenses';
export { UserScopedRepository } from './base';

/**
 * Builds every user-scoped repository for one request. Add new repositories
 * here so route handlers get them from a single place.
 */
export function createRepositories(db: Db, userId: string) {
  return {
    expenses: new ExpensesRepository(db, userId),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
