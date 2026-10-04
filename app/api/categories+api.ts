import { json, readJson, withAuth } from '@/src/server/auth/clerk';
import { categoryInputSchema } from '@/src/lib/schemas/category';

/** F2.4: list. Seeds the defaults if the user somehow has none. */
export const GET = withAuth(async (_req, { repos }) => {
  let items = await repos.categories.list();
  if (items.length === 0) {
    await repos.categories.seedDefaults();
    items = await repos.categories.list();
  }
  return json({ items });
});

export const POST = withAuth(async (req, { repos }) => {
  const parsed = categoryInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  const row = await repos.categories.create(parsed.data);
  return json(row, { status: 201 });
});
