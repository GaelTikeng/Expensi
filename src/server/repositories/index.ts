import type { Db } from '../db/client';
import { AttachmentsRepository } from './attachments';
import { CategoriesRepository } from './categories';
import { ExpensesRepository } from './expenses';
import { ImportsRepository } from './imports';
import { RecapsRepository } from './recaps';

export { UsersRepository } from './users';
export { ReferenceRepository } from './reference';
export { ExpensesRepository } from './expenses';
export { CategoriesRepository } from './categories';
export { RecapsRepository } from './recaps';
export { AttachmentsRepository } from './attachments';
export { ImportsRepository } from './imports';
export { UserScopedRepository } from './base';

/**
 * Builds every user-scoped repository for one request. Add new repositories
 * here so route handlers get them from a single place.
 */
export function createRepositories(db: Db, userId: string) {
  return {
    expenses: new ExpensesRepository(db, userId),
    categories: new CategoriesRepository(db, userId),
    recaps: new RecapsRepository(db, userId),
    attachments: new AttachmentsRepository(db, userId),
    imports: new ImportsRepository(db, userId),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
