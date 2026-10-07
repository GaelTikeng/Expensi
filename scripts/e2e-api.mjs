/**
 * End-to-end API test against the real stack: a running dev server, Neon,
 * Clerk (test instance) and TensorX. Creates one throwaway Clerk user, walks
 * the main flows, deletes the account through the app, and always cleans up.
 *
 *   pnpm start                # in another terminal (serves the API routes)
 *   pnpm test:e2e
 *
 * Override the target with E2E_BASE_URL. Needs CLERK_SECRET_KEY and
 * DATABASE_URL in .env. Makes one real TensorX call (recap narrative).
 */
import { randomUUID } from 'node:crypto';

import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:8081').replace(/\/$/, '');
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const sql = neon(process.env.DATABASE_URL);

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  · ${detail}` : ''}`);
}
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let clerkUserId = null;
let sessionId = null;

async function api(method, path, body) {
  const { jwt } = await clerk.sessions.getToken(sessionId);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${jwt}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

try {
  // ── setup: throwaway Clerk user + session ────────────────────────────────
  const user = await clerk.users.createUser({
    emailAddress: [`e2e-${Date.now()}+clerk_test@example.com`],
    firstName: 'E2E',
    skipPasswordRequirement: true,
  });
  clerkUserId = user.id;
  const session = await clerk.sessions.createSession({ userId: user.id });
  sessionId = session.id;
  check('setup: Clerk test user + session created', Boolean(clerkUserId && sessionId));

  // ── identity ─────────────────────────────────────────────────────────────
  const me = await api('GET', '/api/me');
  check('GET /api/me → 200 and users row', me.status === 200 && Boolean(me.json?.id), `status ${me.status}, currency ${me.json?.defaultCurrency}, tz ${me.json?.timezone}`);
  const rows = await sql`select id from users where clerk_user_id = ${clerkUserId}`;
  check('users row present in Neon', rows.length === 1);

  // ── categories ───────────────────────────────────────────────────────────
  const cats = await api('GET', '/api/categories');
  const catList = cats.json?.items ?? [];
  check('GET /api/categories → 14 defaults seeded', cats.status === 200 && catList.length === 14, `${catList.length} categories`);
  const food = catList.find((c) => c.name.startsWith('Food')) ?? catList[0];

  // ── expenses ─────────────────────────────────────────────────────────────
  const expenseId = randomUUID();
  const body = { id: expenseId, amountMinor: 5000, currency: 'XAF', occurredOn: today, description: 'Riz au marché', payee: 'Marché Mokolo', categoryId: food?.id ?? null };
  const created = await api('POST', '/api/expenses', body);
  check('POST /api/expenses → 201', created.status === 201, `status ${created.status}`);
  const replay = await api('POST', '/api/expenses', body);
  check('POST replay is idempotent → 200, same id', replay.status === 200 && replay.json?.id === expenseId, `status ${replay.status}`);

  const list = await api('GET', '/api/expenses');
  check('GET /api/expenses → 1 item, attachmentCount 0', list.status === 200 && list.json?.items?.length === 1 && list.json.items[0].attachmentCount === 0, `${list.json?.items?.length} items`);

  const search = await api('GET', '/api/expenses?q=mokolo');
  check('search by payee (case-insensitive)', search.json?.items?.length === 1);

  const patched = await api('PATCH', `/api/expenses/${expenseId}`, { amountMinor: 7500 });
  check('PATCH /api/expenses/[id] → amount 7500', patched.status === 200 && Number(patched.json?.amountMinor) === 7500, `status ${patched.status}`);

  const bad = await api('POST', '/api/expenses', { ...body, id: randomUUID(), amountMinor: -5 });
  check('validation rejects negative amount → 400', bad.status === 400, `status ${bad.status}`);

  // ── recaps ───────────────────────────────────────────────────────────────
  const month = await api('GET', `/api/recaps?period=month&start=${today}&narrative=0`);
  const ms = month.json?.recap?.stats;
  check('GET /api/recaps month → total 7500, count 1', month.status === 200 && Number(ms?.totalMinor) === 7500 && ms?.count === 1, `status ${month.status}, total ${ms?.totalMinor}, top category ${ms?.byCategory?.[0]?.name}`);

  const overview = await api('GET', '/api/recaps/overview');
  check('GET /api/recaps/overview → today 7500', overview.status === 200 && Number(overview.json?.today?.totalMinor) === 7500, `status ${overview.status}`);

  const narr = await api('GET', `/api/recaps?period=month&start=${today}&narrative=1`);
  const text = narr.json?.recap?.narrativeMd ?? '';
  check('narrative generated via TensorX', narr.status === 200 && text.length > 20, `${text.length} chars, model ${narr.json?.recap?.model}`);
  if (text) console.log(`      “${text.slice(0, 220)}${text.length > 220 ? '…' : ''}”`);

  const usage = await api('GET', '/api/usage');
  check('GET /api/usage → narrative counted', usage.status === 200 && usage.json?.narrative?.used >= 1, `narrative ${usage.json?.narrative?.used}/${usage.json?.narrative?.limit}, extract ${usage.json?.extract?.used}/${usage.json?.extract?.limit}`);

  // ── delete + stale recap ─────────────────────────────────────────────────
  const del = await api('DELETE', `/api/expenses/${expenseId}`);
  check('DELETE /api/expenses/[id] → 200', del.status === 200, `status ${del.status}`);
  const after = await api('GET', `/api/recaps?period=month&start=${today}&narrative=0`);
  check('recap recomputed after delete → total 0', Number(after.json?.recap?.stats?.totalMinor) === 0, `total ${after.json?.recap?.stats?.totalMinor}`);

  // ── account deletion through the app ─────────────────────────────────────
  const gone = await api('DELETE', '/api/me');
  check('DELETE /api/me → account deleted', gone.status === 200, `status ${gone.status}${gone.json?.error ? `, ${gone.json.error}` : ''}`);
  if (gone.status === 200) clerkUserId = null;
} catch (err) {
  check('unexpected error', false, `${err?.status ?? ''} ${JSON.stringify(err?.errors ?? err?.message ?? String(err))}`);
} finally {
  // ── cleanup, always ──────────────────────────────────────────────────────
  if (clerkUserId) {
    await sql`delete from users where clerk_user_id = ${clerkUserId}`.catch((e) => console.log('cleanup db error', e.message));
    await clerk.users.deleteUser(clerkUserId).catch((e) => console.log('cleanup clerk error', e?.errors?.[0]?.message ?? e.message));
    console.log('cleanup: removed test user from Neon and Clerk manually');
  }
  const leftover = await sql`select count(*)::int as n from users where email like 'e2e-%+clerk_test@example.com'`;
  console.log(`cleanup check: ${leftover[0].n} test users left in Neon`);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
