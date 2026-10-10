import { randomUUID } from 'node:crypto';

import { GET as listExpenses } from '@/app/api/expenses+api';
import { GET as listPlanned, POST as createPlanned } from '@/app/api/planned+api';
import { DELETE as removePlanned, GET as getPlanned, PATCH as patchPlanned } from '@/app/api/planned/[id]+api';
import { POST as complete } from '@/app/api/planned/[id]/complete+api';
import { GET as summary } from '@/app/api/planned/summary+api';
import { GET as listRecurring, POST as createRecurring } from '@/app/api/recurring+api';
import { DELETE as removeRecurring } from '@/app/api/recurring/[id]+api';
import { POST as materialize } from '@/app/api/recurring/materialize+api';

import { call } from '../helpers/api';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

const inTwoDays = () => new Date(Date.now() + 2 * 86_400_000).toISOString();

const plan = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  title: 'Coiffure Alicia',
  amountMinor: 10000,
  currency: 'XAF',
  scheduledAt: inTwoDays(),
  place: 'Bastos',
  ...over,
});

describe('planned expenses', () => {
  it('creates a plan and lists it as upcoming', async () => {
    const body = plan();
    const created = await call(createPlanned, 'POST', '/api/planned', { body });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: body.id, status: 'planned', amountMinor: 10000 });

    const upcoming = await call(listPlanned, 'GET', '/api/planned?status=planned');
    expect(upcoming.json.items.map((p: { id: string }) => p.id)).toEqual([body.id]);
  });

  it('completing a plan creates the expense and links it', async () => {
    const body = plan();
    await call(createPlanned, 'POST', '/api/planned', { body });

    const done = await call(complete, 'POST', `/api/planned/${body.id}/complete`, { params: { id: body.id }, body: { amountMinor: 9500 } });
    expect(done.status).toBe(201);
    expect(done.json.planned).toMatchObject({ status: 'done', completedExpenseId: done.json.expenseId });

    const expenses = await call(listExpenses, 'GET', '/api/expenses');
    expect(expenses.json.items).toHaveLength(1);
    expect(expenses.json.items[0]).toMatchObject({ id: done.json.expenseId, amountMinor: 9500, source: 'planned', description: 'Coiffure Alicia' });

    // A completed plan is no longer upcoming.
    const upcoming = await call(listPlanned, 'GET', '/api/planned?status=planned');
    expect(upcoming.json.items).toEqual([]);
  });

  it('skips, restores and deletes', async () => {
    const body = plan();
    await call(createPlanned, 'POST', '/api/planned', { body });

    const skipped = await call(patchPlanned, 'PATCH', `/api/planned/${body.id}`, { params: { id: body.id }, body: { status: 'skipped' } });
    expect(skipped.json.status).toBe('skipped');
    const restored = await call(patchPlanned, 'PATCH', `/api/planned/${body.id}`, { params: { id: body.id }, body: { status: 'planned' } });
    expect(restored.json.status).toBe('planned');

    expect((await call(removePlanned, 'DELETE', `/api/planned/${body.id}`, { params: { id: body.id } })).status).toBe(200);
    expect((await call(getPlanned, 'GET', `/api/planned/${body.id}`, { params: { id: body.id } })).status).toBe(404);
  });

  it('summarises the year by month', async () => {
    const year = new Date().getFullYear();
    await call(createPlanned, 'POST', '/api/planned', { body: plan({ scheduledAt: `${year}-03-15T10:00:00.000Z` }) });
    const res = await call(summary, 'GET', `/api/planned/summary?year=${year}`);
    expect(res.status).toBe(200);
    expect(res.json.months).toHaveLength(12);
    const march = res.json.months.find((m: { month: string }) => m.month === `${year}-03`);
    expect(march).toMatchObject({ plannedCount: 1, plannedMinor: 10000 });
  });
});

describe('fixed charges', () => {
  const charge = () => ({ id: randomUUID(), name: 'Rent', amountMinor: 150000, currency: 'XAF', dayOfMonth: 5, reminderTime: '09:00', startsOn: '2026-01-01' });

  it('materialises this and next month once, idempotently', async () => {
    await call(createRecurring, 'POST', '/api/recurring', { body: charge() });

    const first = await call(materialize, 'POST', '/api/recurring/materialize');
    expect(first.status).toBe(200);
    expect(first.json.created).toHaveLength(2);
    expect(first.json.created.every((p: { recurringChargeId: string | null }) => p.recurringChargeId)).toBe(true);

    const again = await call(materialize, 'POST', '/api/recurring/materialize');
    expect(again.json.created).toHaveLength(0);

    const list = await call(listRecurring, 'GET', '/api/recurring');
    expect(list.json.items).toHaveLength(1);
    expect(list.json.items[0].currentMonth).toMatchObject({ status: 'planned' });
  });

  it('deleting a charge removes its unpaid plans but keeps paid ones', async () => {
    const body = charge();
    await call(createRecurring, 'POST', '/api/recurring', { body });
    const { json } = await call(materialize, 'POST', '/api/recurring/materialize');
    const [thisMonth] = json.created;
    await call(complete, 'POST', `/api/planned/${thisMonth.id}/complete`, { params: { id: thisMonth.id }, body: {} });

    await call(removeRecurring, 'DELETE', `/api/recurring/${body.id}`, { params: { id: body.id } });

    const all = await call(listPlanned, 'GET', '/api/planned?status=all');
    expect(all.json.items).toHaveLength(1);
    expect(all.json.items[0]).toMatchObject({ id: thisMonth.id, status: 'done' });

    const expenses = await call(listExpenses, 'GET', '/api/expenses');
    expect(expenses.json.items[0]).toMatchObject({ source: 'recurring', amountMinor: 150000 });
  });
});
