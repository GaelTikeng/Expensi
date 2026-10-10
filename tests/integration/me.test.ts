import { DELETE, GET, PATCH } from '@/app/api/me+api';
import { GET as listCategories } from '@/app/api/categories+api';
import { sql } from 'drizzle-orm';

import { call, TEST_USER } from '../helpers/api';
import { db, resetDb } from '../helpers/db';

beforeEach(resetDb);

describe('GET /api/me', () => {
  it('creates the users row and seeds the default categories on first contact', async () => {
    const me = await call(GET, 'GET', '/api/me');
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({ email: `${TEST_USER}@example.com`, defaultCurrency: 'XAF', timezone: 'Africa/Douala' });

    const cats = await call(listCategories, 'GET', '/api/categories');
    expect(cats.json.items).toHaveLength(14);

    const rows = await db.execute(sql`select count(*)::int as n from users`);
    expect(rows.rows[0]).toEqual({ n: 1 });
  });

  it('rejects a request without a session', async () => {
    const res = await call(GET, 'GET', '/api/me', { user: null });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/me', () => {
  it('updates the default currency and timezone', async () => {
    await call(GET, 'GET', '/api/me');
    const res = await call(PATCH, 'PATCH', '/api/me', { body: { defaultCurrency: 'eur', timezone: 'Europe/Paris' } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ defaultCurrency: 'EUR', timezone: 'Europe/Paris' });
  });

  it('rejects a currency the app does not support', async () => {
    await call(GET, 'GET', '/api/me');
    const res = await call(PATCH, 'PATCH', '/api/me', { body: { defaultCurrency: 'ZZZ' } });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/me', () => {
  it('removes every row the user owns', async () => {
    await call(GET, 'GET', '/api/me');
    const res = await call(DELETE, 'DELETE', '/api/me');
    expect(res.status).toBe(200);
    const users = await db.execute(sql`select count(*)::int as n from users`);
    const cats = await db.execute(sql`select count(*)::int as n from categories`);
    expect(users.rows[0]).toEqual({ n: 0 });
    expect(cats.rows[0]).toEqual({ n: 0 });
  });
});
