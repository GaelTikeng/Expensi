/**
 * End-to-end API test against the real stack: a running dev server, Neon,
 * Clerk (test instance) and TensorX. Creates one throwaway Clerk user, walks
 * the main flows, deletes the account through the app, and always cleans up.
 *
 *   pnpm start                # in another terminal (serves the API routes)
 *   pnpm test:e2e
 *
 * Override the target with E2E_BASE_URL. Needs CLERK_SECRET_KEY and
 * DATABASE_URL in .env. Makes one real TensorX call (recap narrative) and,
 * when the S3 group is configured, two real uploads (one deleted through the
 * API, one left for the account purge to remove).
 */
import { randomUUID } from 'node:crypto';

import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
let purgeKey = null;

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

  // ── proof attachments (F2b): presign → PUT to S3 → confirm → view → delete ─
  // A 1×1 PNG, enough for S3 to see a real image/png body.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  async function uploadProof(expenseIdForProof) {
    const id = randomUUID();
    const presign = await api('POST', '/api/attachments/presign', { id, mimeType: 'image/png', sizeBytes: png.length, originalFilename: 'receipt.png', expenseId: expenseIdForProof });
    if (presign.status !== 201) return { presign };
    const put = await fetch(presign.json.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/png', 'content-length': String(png.length) }, body: png });
    const confirm = await api('POST', '/api/attachments', { id, expenseId: expenseIdForProof });
    return { id, key: presign.json.key, presign, put, confirm };
  }
  const first = await uploadProof(expenseId);
  if (first.presign.status === 503) {
    check('attachments: storage configured', false, 'presign returned 503 storage_not_configured — set AWS_* and S3_BUCKET in .env');
  } else {
    check('POST /api/attachments/presign → 201 with upload URL', first.presign.status === 201 && String(first.presign.json?.uploadUrl).includes(first.presign.json?.key), `status ${first.presign.status}`);
    check('PUT to S3 presigned URL → 200', first.put?.status === 200, `status ${first.put?.status}`);
    check('POST /api/attachments confirm → 201, uploadedAt set', first.confirm?.status === 201 && Boolean(first.confirm.json?.uploadedAt), `status ${first.confirm?.status}${first.confirm?.json?.error ? `, ${first.confirm.json.error}` : ''}`);

    const proofs = await api('GET', `/api/attachments?expenseId=${expenseId}`);
    const proof = proofs.json?.items?.[0];
    check('GET /api/attachments?expenseId → 1 item with view URL', proofs.status === 200 && proofs.json?.items?.length === 1 && typeof proof?.url === 'string', `${proofs.json?.items?.length} items`);
    const view = proof?.url ? await fetch(proof.url) : null;
    const viewBytes = view ? Buffer.from(await view.arrayBuffer()) : null;
    check('presigned GET serves the uploaded bytes', view?.status === 200 && viewBytes?.equals(png), `status ${view?.status}, ${viewBytes?.length} bytes`);

    const withProof = await api('GET', '/api/expenses?hasAttachment=true');
    check('expense list shows attachmentCount 1 and hasAttachment filter matches', withProof.json?.items?.length === 1 && withProof.json.items[0].attachmentCount === 1, `${withProof.json?.items?.length} items, count ${withProof.json?.items?.[0]?.attachmentCount}`);

    const removed = await api('DELETE', `/api/attachments/${first.id}`);
    const afterRemove = await api('GET', `/api/attachments?expenseId=${expenseId}`);
    check('DELETE /api/attachments/[id] → 200, list empty', removed.status === 200 && afterRemove.json?.items?.length === 0, `status ${removed.status}`);

    // Second proof stays attached: DELETE /api/me must purge it from S3.
    const second = await uploadProof(expenseId);
    check('second proof uploaded for the purge check', second.confirm?.status === 201, `status ${second.confirm?.status}`);
    purgeKey = second.key;
  }

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
  if (purgeKey) {
    const s3 = new S3Client({ region: process.env.S3_REGION ?? 'eu-central-1' });
    const headStatus = await s3
      .send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: purgeKey }))
      .then(() => 200)
      .catch((e) => e.$metadata?.httpStatusCode ?? e.name);
    check('account purge removed the remaining proof from S3', headStatus === 404, `HeadObject → ${headStatus}`);
  }
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
