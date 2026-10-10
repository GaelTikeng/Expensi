import { randomUUID } from 'node:crypto';

import * as XLSX from 'xlsx';

import { POST as createExpense } from '@/app/api/expenses+api';
import { GET as listExpenses } from '@/app/api/expenses+api';
import { POST as createImport } from '@/app/api/imports+api';
import { GET as getImport } from '@/app/api/imports/[id]+api';
import { POST as commit } from '@/app/api/imports/[id]/commit+api';
import { POST as process } from '@/app/api/imports/[id]/process+api';
import { POST as presign } from '@/app/api/imports/presign+api';
import { GET as usage } from '@/app/api/usage+api';

import { call, extractionReply, mockModelReply, putObject } from '../helpers/api';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function spreadsheet(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Date', 'Description', 'Amount'],
      ['2026-10-05', 'Riz', 5000],
      ['2026-10-06', 'Taxi', 350],
    ]),
    'Sheet1',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const extraction = {
  detectedCurrency: 'XAF',
  detectedLanguage: 'fr',
  documentQuality: 'good',
  lines: [
    { lineIndex: 0, rawText: 'Date\tDescription\tAmount', lineKind: 'header' },
    { lineIndex: 1, rawText: '2026-10-05\tRiz\t5000', lineKind: 'expense', amountMinor: 5000, occurredOn: '2026-10-05', description: 'Riz', confidence: 0.95, categoryGuess: 'Food & Groceries' },
    { lineIndex: 2, rawText: '2026-10-06\tTaxi\t350', lineKind: 'expense', amountMinor: 350, occurredOn: '2026-10-06', description: 'Taxi', confidence: 0.9, categoryGuess: 'Transport' },
  ],
};

/** presign → upload → create: the import row in `queued`. */
async function uploadSpreadsheet(): Promise<string> {
  const id = randomUUID();
  const bytes = spreadsheet();
  const pre = await call(presign, 'POST', '/api/imports/presign', { body: { id, mimeType: XLSX_MIME, sizeBytes: bytes.length, originalFilename: 'week.xlsx' } });
  expect(pre.status).toBe(201);
  putObject(pre.json.key, bytes, XLSX_MIME);
  const created = await call(createImport, 'POST', '/api/imports', { body: { id, storageKey: pre.json.key, mimeType: XLSX_MIME, sizeBytes: bytes.length, originalFilename: 'week.xlsx' } });
  expect(created.status).toBe(201);
  expect(created.json.status).toBe('queued');
  return id;
}

describe('file import', () => {
  it('parses, stages the model output, flags duplicates, and commits', async () => {
    // An expense already in the ledger with the same amount and day as line 1.
    const existing = { id: randomUUID(), amountMinor: 5000, currency: 'XAF', occurredOn: '2026-10-05', description: 'Riz marché' };
    await call(createExpense, 'POST', '/api/expenses', { body: existing });

    const id = await uploadSpreadsheet();
    mockModelReply(extractionReply(extraction));
    const processed = await call(process, 'POST', `/api/imports/${id}/process`, { params: { id } });
    expect(processed.status).toBe(200);
    expect(processed.json.import).toMatchObject({ status: 'review', sourceType: 'xlsx', model: 'z-ai/glm-5.3-flash', detectedCurrency: 'XAF' });
    expect(processed.json.items).toHaveLength(3);

    const [header, riz, taxi] = processed.json.items;
    expect(header.lineKind).toBe('header');
    expect(riz).toMatchObject({ amountMinor: 5000, occurredOn: '2026-10-05', currency: 'XAF', possibleDuplicateOf: { id: existing.id, description: 'Riz marché' } });
    expect(riz.categoryId).toBeTruthy(); // "Food & Groceries" resolved to the seeded category
    expect(taxi.possibleDuplicateOf).toBeNull();

    const committed = await call(commit, 'POST', `/api/imports/${id}/commit`, { params: { id }, body: { acceptedItemIds: [riz.id, taxi.id] } });
    expect(committed.status).toBe(201);
    expect(committed.json.created).toBe(2);

    const ledger = await call(listExpenses, 'GET', '/api/expenses');
    expect(ledger.json.items).toHaveLength(3);
    expect(ledger.json.items.filter((e: { source: string }) => e.source === 'import')).toHaveLength(2);

    // After commit a line is its own expense: it must not be flagged as a
    // duplicate of itself, but still points at the pre-existing one.
    const detail = await call(getImport, 'GET', `/api/imports/${id}`, { params: { id } });
    expect(detail.json.import.status).toBe('committed');
    const rizAfter = detail.json.items.find((i: { id: string }) => i.id === riz.id);
    expect(rizAfter.expenseId).toBeTruthy();
    expect(rizAfter.possibleDuplicateOf?.id).toBe(existing.id);
    const taxiAfter = detail.json.items.find((i: { id: string }) => i.id === taxi.id);
    expect(taxiAfter.possibleDuplicateOf).toBeNull();

    const quota = await call(usage, 'GET', '/api/usage');
    expect(quota.json.extract.used).toBe(1);
  });

  it('turns a cut-off model reply into a readable failure and allows a retry', async () => {
    const id = await uploadSpreadsheet();
    mockModelReply({ model: 'z-ai/glm-5.3-flash', usage: {}, choices: [{ finish_reason: 'length', message: { content: '' } }] });
    const failed = await call(process, 'POST', `/api/imports/${id}/process`, { params: { id } });
    expect(failed.json.import).toMatchObject({ status: 'failed', attemptCount: 1 });
    expect(failed.json.import.failureReason).toMatch(/too large/);

    mockModelReply(extractionReply(extraction));
    const retried = await call(process, 'POST', `/api/imports/${id}/process`, { params: { id } });
    expect(retried.json.import).toMatchObject({ status: 'review', attemptCount: 2 });
  });

  it('refuses a storage key outside the user prefix', async () => {
    const res = await call(createImport, 'POST', '/api/imports', { body: { id: randomUUID(), storageKey: 'users/someone-else/imports/x.xlsx', mimeType: XLSX_MIME, sizeBytes: 10 } });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('invalid_storage_key');
  });
});
