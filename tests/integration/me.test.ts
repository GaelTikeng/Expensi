import { DELETE, GET, PATCH } from '@/app/api/me+api';
import { POST as avatarPresign } from '@/app/api/me/avatar+api';
import { GET as listCategories } from '@/app/api/categories+api';
import { sql } from 'drizzle-orm';

import { call, hasObject, putObject, TEST_USER } from '../helpers/api';
import { db, resetDb } from '../helpers/db';

beforeEach(resetDb);

describe('GET /api/me', () => {
  it('creates the users row and seeds the default categories on first contact', async () => {
    const me = await call(GET, 'GET', '/api/me');
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({
      email: `${TEST_USER}@example.com`,
      displayName: `Test ${TEST_USER}`,
      defaultCurrency: 'XAF',
      timezone: 'Africa/Douala',
      imageUrl: `https://img.clerk.test/${TEST_USER}.png`,
      avatarKey: null,
      avatarUrl: null,
      phone: null,
    });

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

  it('updates the profile fields (E15)', async () => {
    await call(GET, 'GET', '/api/me');
    const res = await call(PATCH, 'PATCH', '/api/me', { body: { displayName: '  Gaël  ', phone: '+237 690 92 00 54' } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ displayName: 'Gaël', phone: '+237 690 92 00 54' });
    expect((await call(PATCH, 'PATCH', '/api/me', { body: { phone: 'call me' } })).status).toBe(400);
    expect((await call(PATCH, 'PATCH', '/api/me', { body: { displayName: '' } })).status).toBe(400);
  });

  it('rejects a currency the app does not support', async () => {
    await call(GET, 'GET', '/api/me');
    const res = await call(PATCH, 'PATCH', '/api/me', { body: { defaultCurrency: 'ZZZ' } });
    expect(res.status).toBe(400);
  });
});

describe('avatar (E15)', () => {
  const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

  it('presign → upload → confirm → served, then replaced and removed', async () => {
    const me = await call(GET, 'GET', '/api/me');
    const pre = await call(avatarPresign, 'POST', '/api/me/avatar', { body: { sizeBytes: jpeg.length } });
    expect(pre.status).toBe(201);
    expect(pre.json.key).toMatch(new RegExp(`^users/${me.json.id}/avatar/[0-9a-f-]{36}\\.jpg$`));

    // Confirming before the upload is refused.
    expect((await call(PATCH, 'PATCH', '/api/me', { body: { avatarKey: pre.json.key } })).status).toBe(409);

    putObject(pre.json.key, jpeg, 'image/jpeg');
    const set = await call(PATCH, 'PATCH', '/api/me', { body: { avatarKey: pre.json.key } });
    expect(set.status).toBe(200);
    expect(set.json.avatarKey).toBe(pre.json.key);
    expect(set.json.avatarUrl).toContain(pre.json.key);

    // A second upload replaces the first object.
    const pre2 = await call(avatarPresign, 'POST', '/api/me/avatar', { body: { sizeBytes: jpeg.length } });
    putObject(pre2.json.key, jpeg, 'image/jpeg');
    await call(PATCH, 'PATCH', '/api/me', { body: { avatarKey: pre2.json.key } });
    expect(hasObject(pre.json.key)).toBe(false);
    expect(hasObject(pre2.json.key)).toBe(true);

    // Removing falls back to the provider picture.
    const cleared = await call(PATCH, 'PATCH', '/api/me', { body: { avatarKey: null } });
    expect(cleared.json).toMatchObject({ avatarKey: null, avatarUrl: null, imageUrl: expect.stringContaining('img.clerk.test') });
    expect(hasObject(pre2.json.key)).toBe(false);
  });

  it('refuses a key outside the user prefix', async () => {
    await call(GET, 'GET', '/api/me');
    const res = await call(PATCH, 'PATCH', '/api/me', { body: { avatarKey: 'users/someone-else/avatar/0199c4b4-0000-7000-8000-000000000001.jpg' } });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('invalid_avatar_key');
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
