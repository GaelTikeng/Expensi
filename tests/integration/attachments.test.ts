import { randomUUID } from 'node:crypto';

import { GET as listAttachments, POST as confirm } from '@/app/api/attachments+api';
import { DELETE as removeAttachment } from '@/app/api/attachments/[id]+api';
import { GET as viewUrl } from '@/app/api/attachments/[id]/url+api';
import { POST as presign } from '@/app/api/attachments/presign+api';
import { GET as listExpenses, POST as createExpense } from '@/app/api/expenses+api';
import { DELETE as deleteMe } from '@/app/api/me+api';

import { call, hasObject, putObject } from '../helpers/api';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function anExpense(): Promise<string> {
  const body = { id: randomUUID(), amountMinor: 5000, currency: 'XAF', occurredOn: '2026-10-10', description: 'Riz' };
  await call(createExpense, 'POST', '/api/expenses', { body });
  return body.id;
}

describe('proof attachments', () => {
  it('presign → upload → confirm → list → delete', async () => {
    const expenseId = await anExpense();
    const id = randomUUID();

    const pre = await call(presign, 'POST', '/api/attachments/presign', { body: { id, mimeType: 'image/png', sizeBytes: png.length, originalFilename: 'receipt.png', expenseId } });
    expect(pre.status).toBe(201);
    expect(pre.json.key).toMatch(/^users\/.+\/\d{4}\/\d{2}\/.+\.png$/);

    // Confirming before the bytes landed is refused.
    const early = await call(confirm, 'POST', '/api/attachments', { body: { id, expenseId } });
    expect(early.status).toBe(409);

    putObject(pre.json.key, png, 'image/png');
    const ok = await call(confirm, 'POST', '/api/attachments', { body: { id, expenseId } });
    expect(ok.status).toBe(201);
    expect(ok.json.uploadedAt).toBeTruthy();

    const list = await call(listAttachments, 'GET', `/api/attachments?expenseId=${expenseId}`);
    expect(list.json.items).toHaveLength(1);
    expect(list.json.items[0].url).toContain(pre.json.key);

    const url = await call(viewUrl, 'GET', `/api/attachments/${id}/url`, { params: { id } });
    expect(url.json.mimeType).toBe('image/png');

    const expenses = await call(listExpenses, 'GET', '/api/expenses?hasAttachment=true');
    expect(expenses.json.items[0].attachmentCount).toBe(1);

    await call(removeAttachment, 'DELETE', `/api/attachments/${id}`, { params: { id } });
    expect((await call(listAttachments, 'GET', `/api/attachments?expenseId=${expenseId}`)).json.items).toEqual([]);
    expect(hasObject(pre.json.key)).toBe(false);
  });

  it('refuses an object whose type differs from what was declared', async () => {
    const expenseId = await anExpense();
    const id = randomUUID();
    const pre = await call(presign, 'POST', '/api/attachments/presign', { body: { id, mimeType: 'image/png', sizeBytes: 10, expenseId } });
    putObject(pre.json.key, Buffer.from('%PDF-1.4 x'), 'application/pdf');
    const res = await call(confirm, 'POST', '/api/attachments', { body: { id, expenseId } });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('content_type_mismatch');
    expect(hasObject(pre.json.key)).toBe(false);
  });

  it('account deletion purges the user prefix in storage', async () => {
    const expenseId = await anExpense();
    const id = randomUUID();
    const pre = await call(presign, 'POST', '/api/attachments/presign', { body: { id, mimeType: 'image/png', sizeBytes: png.length, expenseId } });
    putObject(pre.json.key, png, 'image/png');
    await call(confirm, 'POST', '/api/attachments', { body: { id, expenseId } });

    await call(deleteMe, 'DELETE', '/api/me');
    expect(hasObject(pre.json.key)).toBe(false);
  });
});
