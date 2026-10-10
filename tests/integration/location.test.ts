import { randomUUID } from 'node:crypto';

import { GET as list, POST as create } from '@/app/api/expenses+api';
import { GET as getOne, PATCH as patch } from '@/app/api/expenses/[id]+api';
import { GET as exportRoute } from '@/app/api/expenses/export+api';

import { call } from '../helpers/api';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

const base = () => ({ id: randomUUID(), amountMinor: 2500, currency: 'XAF', occurredOn: '2026-10-10', description: 'Lunch – ndolé', payee: 'Chez Wou' });
// Bastos, Yaoundé.
const bastos = { latitude: 3.8886, longitude: 11.5174, locationLabel: 'Bastos, Yaoundé' };

describe('expense location (E16)', () => {
  it('stores and returns the position when provided, null otherwise', async () => {
    const withPlace = { ...base(), ...bastos };
    const created = await call(create, 'POST', '/api/expenses', { body: withPlace });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject(bastos);

    const without = await call(create, 'POST', '/api/expenses', { body: base() });
    expect(without.json).toMatchObject({ latitude: null, longitude: null, locationLabel: null });

    const got = await call(getOne, 'GET', `/api/expenses/${withPlace.id}`, { params: { id: withPlace.id } });
    expect(got.json).toMatchObject(bastos);
    const rows = await call(list, 'GET', '/api/expenses');
    expect(rows.json.items.find((e: { id: string }) => e.id === withPlace.id)).toMatchObject(bastos);
  });

  it('rejects coordinates out of range and a lone coordinate', async () => {
    expect((await call(create, 'POST', '/api/expenses', { body: { ...base(), latitude: 95, longitude: 11 } })).status).toBe(400);
    expect((await call(create, 'POST', '/api/expenses', { body: { ...base(), latitude: 3.9, longitude: 190 } })).status).toBe(400);
    const lone = await call(create, 'POST', '/api/expenses', { body: { ...base(), latitude: 3.9 } });
    expect(lone.status).toBe(400);
    expect(lone.json.error).toBe('invalid_body');
  });

  it('can be removed afterwards', async () => {
    const body = { ...base(), ...bastos };
    await call(create, 'POST', '/api/expenses', { body });
    const cleared = await call(patch, 'PATCH', `/api/expenses/${body.id}`, { params: { id: body.id }, body: { latitude: null, longitude: null, locationLabel: null } });
    expect(cleared.status).toBe(200);
    expect(cleared.json).toMatchObject({ latitude: null, longitude: null, locationLabel: null });
  });

  it('never reaches the export files', async () => {
    await call(create, 'POST', '/api/expenses', { body: { ...base(), ...bastos } });
    const xlsx = await call(exportRoute, 'GET', '/api/expenses/export?from=2026-10-01&to=2026-10-31&format=xlsx');
    expect(xlsx.status).toBe(200);
    // SheetJS stores cell text in shared strings as plain XML; the label must not be there.
    expect((await xlsx.bytes()).includes(Buffer.from('Bastos'))).toBe(false);
  });
});
