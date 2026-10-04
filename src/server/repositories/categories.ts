import { and, asc, count, eq, isNull } from 'drizzle-orm';

import { DEFAULT_CATEGORIES } from '../data/default-categories';
import { categories, expenses, type Category } from '../db/schema';
import { badRequest, conflict, notFound } from '../errors';
import type { CategoryInput, CategoryPatch } from '@/src/lib/schemas/category';
import { UserScopedRepository } from './base';

export class CategoriesRepository extends UserScopedRepository {
  private scope() {
    return and(eq(categories.userId, this.userId), isNull(categories.deletedAt));
  }

  list(): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(this.scope())
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async findById(id: string): Promise<Category | undefined> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(and(this.scope(), eq(categories.id, id)))
      .limit(1);
    return row;
  }

  /** Idempotent: only inserts when the user has no categories at all. */
  async seedDefaults(): Promise<number> {
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(categories)
      .where(eq(categories.userId, this.userId));
    if (n > 0) return 0;
    await this.db.insert(categories).values(
      DEFAULT_CATEGORIES.map((c, i) => ({ ...c, userId: this.userId, sortOrder: i })),
    );
    return DEFAULT_CATEGORIES.length;
  }

  async create(input: CategoryInput): Promise<Category> {
    await this.assertParentOk(input.parentId ?? null, null);

    // (user_id, name) is unique across soft-deleted rows too. Revive instead
    // of failing when the user re-creates a category they deleted earlier.
    const [existing] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, this.userId), eq(categories.name, input.name)))
      .limit(1);
    if (existing && !existing.deletedAt) throw conflict('category_exists', 'A category with that name already exists');
    if (existing) {
      const [revived] = await this.db
        .update(categories)
        .set({ ...input, deletedAt: null, updatedAt: new Date() })
        .where(eq(categories.id, existing.id))
        .returning();
      return revived;
    }

    const [row] = await this.db
      .insert(categories)
      .values({ ...input, userId: this.userId })
      .returning();
    return row;
  }

  async update(id: string, patch: CategoryPatch): Promise<Category> {
    const current = await this.findById(id);
    if (!current) throw notFound('category');
    if (patch.parentId !== undefined) await this.assertParentOk(patch.parentId, id);
    const [row] = await this.db
      .update(categories)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(this.scope(), eq(categories.id, id)))
      .returning();
    return row;
  }

  /** Soft-deletes and detaches the user's expenses from it. */
  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(this.scope(), eq(categories.id, id)))
      .returning({ id: categories.id });
    if (rows.length === 0) return false;
    await this.db
      .update(expenses)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(and(eq(expenses.userId, this.userId), eq(expenses.categoryId, id)));
    // Children become top-level rather than orphans.
    await this.db
      .update(categories)
      .set({ parentId: null, updatedAt: new Date() })
      .where(and(this.scope(), eq(categories.parentId, id)));
    return true;
  }

  private async assertParentOk(parentId: string | null, selfId: string | null) {
    if (!parentId) return;
    if (parentId === selfId) throw badRequest('category_self_parent');
    const parent = await this.findById(parentId);
    if (!parent) throw badRequest('category_parent_not_found');
    if (parent.parentId) throw badRequest('category_depth_exceeded', 'Only one level of nesting is allowed');
  }
}
