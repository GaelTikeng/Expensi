import { randomUUID } from 'node:crypto';

import { GET as listCategories } from '@/app/api/categories+api';
import { GET as list, POST as create } from '@/app/api/expenses+api';
import { DELETE as remove, GET as getOne, PATCH as patch } from '@/app/api/expenses/[id]+api';
import { GET as exportRoute } from '@/app/api/expenses/export+api';

import { call } from '../helpers/api';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

const TODAY = '2026-10-10';

async function foodCategory(): Promise<string> {
  const cats = await call(listCategories, 'GET', '/api/categories');
  return cats.json.items.find((c: { name: string }) => c.name.startsWith('Food')).id;
}

const expense = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  amountMinor: 5000,
  currency: 'XAF',
  occurredOn: TODAY,
  description: 'Riz au marché',
  payee: 'Marché Mokolo',
  ...over,
});

describe('POST /api/expenses', () => {
  it('creates once and replays idempotently on the client id', async () => {
    const body = expense();
    const first = await call(create, 'POST', '/api/expenses', { body });
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({ id: body.id, amountMinor: 5000, source: 'manual' });

    const again = await call(create, 'POST', '/api/expenses', { body });
    expect(again.status).toBe(200);
    expect(again.json.id).toBe(body.id);
  });

  it('rejects a negative amount and an unknown currency', async () => {
    expect((await call(create, 'POST', '/api/expenses', { body: expense({ amountMinor: -5 }) })).status).toBe(400);
    expect((await call(create, 'POST', '/api/expenses', { body: expense({ currency: 'ZZZ' }) })).status).toBe(400);
  });

  it('rejects a category that belongs to someone else', async () => {
    const otherCategory = await (async () => {
      const cats = await call(listCategories, 'GET', '/api/categories', { user: 'user_other' });
      return cats.json.items[0].id as string;
    })();
    const res = await call(create, 'POST', '/api/expenses', { body: expense({ categoryId: otherCategory }) });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('category_not_found');
  });
});

describe('GET /api/expenses', () => {
  it('lists newest first, searches, and filters by category', async () => {
    const food = await foodCategory();
    await call(create, 'POST', '/api/expenses', { body: expense({ occurredOn: '2026-10-01', description: 'Old', categoryId: food }) });
    await call(create, 'POST', '/api/expenses', { body: expense({ occurredOn: '2026-10-09', description: 'Taxi', payee: 'Taxi' }) });

    const all = await call(list, 'GET', '/api/expenses');
    expect(all.json.items.map((e: { description: string }) => e.description)).toEqual(['Taxi', 'Old']);
    expect(all.json.nextOffset).toBeNull();

    const search = await call(list, 'GET', '/api/expenses?q=mokolo');
    expect(search.json.items).toHaveLength(1);

    const byCat = await call(list, 'GET', `/api/expenses?categoryId=${food}`);
    expect(byCat.json.items.map((e: { description: string }) => e.description)).toEqual(['Old']);
  });

  it('never shows another user their rows', async () => {
    await call(create, 'POST', '/api/expenses', { body: expense() });
    const other = await call(list, 'GET', '/api/expenses', { user: 'user_other' });
    expect(other.json.items).toEqual([]);
  });

  it('paginates with nextOffset', async () => {
    for (let i = 0; i < 3; i++) await call(create, 'POST', '/api/expenses', { body: expense({ description: `e${i}` }) });
    const page = await call(list, 'GET', '/api/expenses?limit=2');
    expect(page.json.items).toHaveLength(2);
    expect(page.json.nextOffset).toBe(2);
  });
});

describe('expense detail', () => {
  it('reads, updates and deletes one expense', async () => {
    const body = expense();
    await call(create, 'POST', '/api/expenses', { body });

    const got = await call(getOne, 'GET', `/api/expenses/${body.id}`, { params: { id: body.id } });
    expect(got.status).toBe(200);
    expect(got.json.attachmentCount).toBe(0);

    const upd = await call(patch, 'PATCH', `/api/expenses/${body.id}`, { params: { id: body.id }, body: { amountMinor: 7500 } });
    expect(upd.status).toBe(200);
    expect(upd.json.amountMinor).toBe(7500);

    const del = await call(remove, 'DELETE', `/api/expenses/${body.id}`, { params: { id: body.id } });
    expect(del.status).toBe(200);
    expect((await call(getOne, 'GET', `/api/expenses/${body.id}`, { params: { id: body.id } })).status).toBe(404);
  });

  it('is 404 for another user', async () => {
    const body = expense();
    await call(create, 'POST', '/api/expenses', { body });
    const res = await call(getOne, 'GET', `/api/expenses/${body.id}`, { params: { id: body.id }, user: 'user_other' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/expenses/export', () => {
  it('summarises, and produces a spreadsheet and a PDF for the range', async () => {
    await call(create, 'POST', '/api/expenses', { body: expense() });
    await call(create, 'POST', '/api/expenses', { body: expense({ amountMinor: 1250, currency: 'EUR', occurredOn: '2026-10-02' }) });

    const summary = await call(exportRoute, 'GET', '/api/expenses/export?from=2026-10-01&to=2026-10-31&format=summary');
    expect(summary.status).toBe(200);
    expect(summary.json).toEqual({
      count: 2,
      byCurrency: expect.arrayContaining([
        { currency: 'XAF', totalMinor: 5000, count: 1 },
        { currency: 'EUR', totalMinor: 1250, count: 1 },
      ]),
    });

    const xlsx = await call(exportRoute, 'GET', '/api/expenses/export?from=2026-10-01&to=2026-10-31&format=xlsx');
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get('content-disposition')).toBe('attachment; filename="xpens-ia_2026-10-01_2026-10-31.xlsx"');
    expect((await xlsx.bytes()).subarray(0, 2).toString()).toBe('PK');

    const pdf = await call(exportRoute, 'GET', '/api/expenses/export?from=2026-10-01&to=2026-10-31&format=pdf');
    expect(pdf.status).toBe(200);
    expect((await pdf.bytes()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects a reversed range and a range over two years', async () => {
    expect((await call(exportRoute, 'GET', '/api/expenses/export?from=2026-10-10&to=2026-10-01&format=pdf')).json.error).toBe('reversed_range');
    expect((await call(exportRoute, 'GET', '/api/expenses/export?from=2020-01-01&to=2026-10-01&format=pdf')).json.error).toBe('range_too_long');
  });
});
