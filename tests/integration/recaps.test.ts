import { randomUUID } from 'node:crypto';

import { GET as listCategories } from '@/app/api/categories+api';
import { POST as create } from '@/app/api/expenses+api';
import { DELETE as remove } from '@/app/api/expenses/[id]+api';
import { GET as recap } from '@/app/api/recaps+api';
import { GET as overview } from '@/app/api/recaps/overview+api';
import { GET as usage } from '@/app/api/usage+api';

import { call, mockModelReply } from '../helpers/api';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

const today = new Date().toISOString().slice(0, 10);

describe('recaps', () => {
  it('computes month stats from the ledger and recomputes after a delete', async () => {
    const cats = await call(listCategories, 'GET', '/api/categories');
    const food = cats.json.items.find((c: { name: string }) => c.name.startsWith('Food')).id;
    const a = { id: randomUUID(), amountMinor: 5000, currency: 'XAF', occurredOn: today, description: 'Riz', categoryId: food, payee: 'Mokolo' };
    const b = { id: randomUUID(), amountMinor: 350, currency: 'XAF', occurredOn: today, description: 'Taxi', payee: 'Taxi' };
    await call(create, 'POST', '/api/expenses', { body: a });
    await call(create, 'POST', '/api/expenses', { body: b });

    const month = await call(recap, 'GET', `/api/recaps?period=month&start=${today}&narrative=0`);
    expect(month.status).toBe(200);
    const s = month.json.recap.stats;
    expect(s).toMatchObject({ totalMinor: 5350, count: 2, currency: 'XAF' });
    expect(s.byCategory[0]).toMatchObject({ name: 'Food & Groceries', totalMinor: 5000 });
    expect(s.byPayee.map((p: { payee: string }) => p.payee)).toEqual(['Mokolo', 'Taxi']);

    const home = await call(overview, 'GET', '/api/recaps/overview');
    expect(home.json.today.totalMinor).toBe(5350);

    await call(remove, 'DELETE', `/api/expenses/${a.id}`, { params: { id: a.id } });
    const after = await call(recap, 'GET', `/api/recaps?period=month&start=${today}&narrative=0`);
    expect(after.json.recap.stats.totalMinor).toBe(350);
  });

  it('writes the narrative on demand, stores it, and counts it against the quota', async () => {
    await call(create, 'POST', '/api/expenses', { body: { id: randomUUID(), amountMinor: 5000, currency: 'XAF', occurredOn: today, description: 'Riz' } });

    const without = await call(recap, 'GET', `/api/recaps?period=month&start=${today}&narrative=0`);
    expect(without.json.recap.narrativeMd).toBeNull();

    mockModelReply({ model: 'z-ai/glm-5.3', usage: { prompt_tokens: 300, completion_tokens: 120 }, choices: [{ finish_reason: 'stop', message: { content: 'You spent 5 000 FCFA on one thing: rice.' } }] });
    const withText = await call(recap, 'GET', `/api/recaps?period=month&start=${today}&narrative=1`);
    expect(withText.json.recap.narrativeMd).toContain('rice');

    // Stored: a second request does not call the model (no reply queued, so it would throw).
    const again = await call(recap, 'GET', `/api/recaps?period=month&start=${today}&narrative=1`);
    expect(again.json.recap.narrativeMd).toContain('rice');

    const quota = await call(usage, 'GET', '/api/usage');
    expect(quota.json.narrative.used).toBe(1);
  });

  it('rejects an unknown period', async () => {
    expect((await call(recap, 'GET', '/api/recaps?period=decade')).status).toBe(400);
  });
});
