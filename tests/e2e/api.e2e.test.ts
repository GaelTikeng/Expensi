/**
 * End-to-end against the real stack: a running dev server (`pnpm start`),
 * Neon, Clerk (test instance), TensorX and S3. Creates one throwaway Clerk
 * user, walks the main flows, deletes the account through the app, and
 * always cleans up.
 *
 *   pnpm start                                  # in another terminal
 *   E2E_BASE_URL=http://localhost:8083 pnpm test:e2e
 *
 * Steps build on each other, so they run in file order.
 */
import { randomUUID } from 'node:crypto';

import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const sql = neon(process.env.DATABASE_URL!);

const pad = (n: number) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let clerkUserId: string | null = null;
let sessionId: string | null = null;
let purgeKey: string | null = null;
const expenseId = randomUUID();
let foodId: string | null = null;
let attachmentId: string | null = null;

async function jwt(): Promise<string> {
  const { jwt } = await clerk.sessions.getToken(sessionId!);
  return jwt;
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${await jwt()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, headers: res.headers };
}

async function raw(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${await jwt()}` } });
  return { status: res.status, bytes: Buffer.from(await res.arrayBuffer()), headers: res.headers };
}

async function uploadProof(forExpense: string) {
  const id = randomUUID();
  const presign = await api('POST', '/api/attachments/presign', { id, mimeType: 'image/png', sizeBytes: png.length, originalFilename: 'receipt.png', expenseId: forExpense });
  expect(presign.status).toBe(201);
  const put = await fetch(presign.json.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/png', 'content-length': String(png.length) }, body: png });
  expect(put.status).toBe(200);
  const confirm = await api('POST', '/api/attachments', { id, expenseId: forExpense });
  expect(confirm.status).toBe(201);
  return { id, key: presign.json.key as string };
}

beforeAll(async () => {
  const user = await clerk.users.createUser({ emailAddress: [`e2e-${Date.now()}+clerk_test@example.com`], firstName: 'E2E', skipPasswordRequirement: true });
  clerkUserId = user.id;
  const session = await clerk.sessions.createSession({ userId: user.id });
  sessionId = session.id;
});

afterAll(async () => {
  // Belt and braces: the last step deletes the account; this catches an aborted run.
  if (!clerkUserId) return;
  await sql`delete from users where clerk_user_id = ${clerkUserId}`.catch(() => undefined);
  await clerk.users.deleteUser(clerkUserId).catch(() => undefined);
});

describe('identity', () => {
  it('GET /api/me creates the users row', async () => {
    const me = await api('GET', '/api/me');
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({ defaultCurrency: 'XAF', timezone: 'Africa/Douala' });
    const rows = await sql`select id from users where clerk_user_id = ${clerkUserId}`;
    expect(rows).toHaveLength(1);
  });

  it('seeds the 14 default categories', async () => {
    const cats = await api('GET', '/api/categories');
    expect(cats.json.items).toHaveLength(14);
    foodId = cats.json.items.find((c: { name: string }) => c.name.startsWith('Food'))?.id ?? cats.json.items[0].id;
  });
});

describe('expenses', () => {
  const body = () => ({ id: expenseId, amountMinor: 5000, currency: 'XAF', occurredOn: today, description: 'Riz au marché', payee: 'Marché Mokolo', categoryId: foodId });

  it('creates once, replays idempotently', async () => {
    expect((await api('POST', '/api/expenses', body())).status).toBe(201);
    const replay = await api('POST', '/api/expenses', body());
    expect(replay.status).toBe(200);
    expect(replay.json.id).toBe(expenseId);
  });

  it('lists, searches, validates', async () => {
    const list = await api('GET', '/api/expenses');
    expect(list.json.items).toHaveLength(1);
    expect(list.json.items[0].attachmentCount).toBe(0);
    expect((await api('GET', '/api/expenses?q=mokolo')).json.items).toHaveLength(1);
    expect((await api('POST', '/api/expenses', { ...body(), id: randomUUID(), amountMinor: -5 })).status).toBe(400);
  });
});

describe('proof attachments (S3)', () => {
  it('presign → PUT → confirm → list → view → delete', async () => {
    const first = await uploadProof(expenseId);
    attachmentId = first.id;
    const list = await api('GET', `/api/attachments?expenseId=${expenseId}`);
    expect(list.json.items).toHaveLength(1);
    const view = await fetch(list.json.items[0].url);
    expect(view.status).toBe(200);
    expect(Buffer.from(await view.arrayBuffer()).equals(png)).toBe(true);

    const withProof = await api('GET', '/api/expenses?hasAttachment=true');
    expect(withProof.json.items[0].attachmentCount).toBe(1);

    expect((await api('DELETE', `/api/attachments/${attachmentId}`)).status).toBe(200);
    expect((await api('GET', `/api/attachments?expenseId=${expenseId}`)).json.items).toHaveLength(0);
  });

  it('leaves a second proof for the account purge', async () => {
    purgeKey = (await uploadProof(expenseId)).key;
  });
});

describe('export (E10)', () => {
  const range = () => `from=${today}&to=${today}`;
  it('summary, xlsx and pdf', async () => {
    const summary = await api('GET', `/api/expenses/export?${range()}&format=summary`);
    expect(summary.json).toMatchObject({ count: 1 });
    const xlsx = await raw(`/api/expenses/export?${range()}&format=xlsx`);
    expect(xlsx.status).toBe(200);
    expect(xlsx.bytes.subarray(0, 2).toString()).toBe('PK');
    expect(xlsx.headers.get('content-disposition')).toMatch(/attachment; filename="xpens-ia_/);
    const pdf = await raw(`/api/expenses/export?${range()}&format=pdf`);
    expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });
  it('rejects a reversed range', async () => {
    expect((await api('GET', `/api/expenses/export?from=${today}&to=2020-01-01&format=pdf`)).status).toBe(400);
  });
});

describe('edit and recaps', () => {
  it('PATCH changes the amount', async () => {
    const patched = await api('PATCH', `/api/expenses/${expenseId}`, { amountMinor: 7500 });
    expect(patched.status).toBe(200);
    expect(Number(patched.json.amountMinor)).toBe(7500);
  });

  it('month recap and overview reflect the ledger', async () => {
    const month = await api('GET', `/api/recaps?period=month&start=${today}&narrative=0`);
    expect(month.json.recap.stats).toMatchObject({ totalMinor: 7500, count: 1 });
    const overview = await api('GET', '/api/recaps/overview');
    expect(overview.json.today.totalMinor).toBe(7500);
  });

  it('writes a narrative with TensorX and counts it', async () => {
    const narr = await api('GET', `/api/recaps?period=month&start=${today}&narrative=1`);
    expect(narr.status).toBe(200);
    expect((narr.json.recap.narrativeMd ?? '').length).toBeGreaterThan(20);
    const usage = await api('GET', '/api/usage');
    expect(usage.json.narrative.used).toBeGreaterThanOrEqual(1);
  });

  it('delete recomputes the recap', async () => {
    expect((await api('DELETE', `/api/expenses/${expenseId}`)).status).toBe(200);
    const after = await api('GET', `/api/recaps?period=month&start=${today}&narrative=0`);
    expect(Number(after.json.recap.stats.totalMinor)).toBe(0);
  });
});

describe('account deletion', () => {
  it('DELETE /api/me removes the account and purges storage', async () => {
    const gone = await api('DELETE', '/api/me');
    expect(gone.status).toBe(200);
    const leftover = await sql`select count(*)::int as n from users where clerk_user_id = ${clerkUserId}`;
    expect(leftover[0].n).toBe(0);
    if (purgeKey) {
      const s3 = new S3Client({ region: process.env.S3_REGION ?? 'eu-central-1' });
      const status = await s3
        .send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: purgeKey }))
        .then(() => 200)
        .catch((e: { $metadata?: { httpStatusCode?: number } }) => e.$metadata?.httpStatusCode ?? 0);
      expect(status).toBe(404);
    }
    clerkUserId = null;
  });
});
