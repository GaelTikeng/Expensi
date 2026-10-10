import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { buildDataset, type ExportableExpense } from './dataset';
import { buildPdf } from './pdf';
import { buildXlsx } from './xlsx';

const categories = [
  { id: 'c-food', name: 'Food & Groceries' },
  { id: 'c-tx', name: 'Transport' },
];

const expense = (over: Partial<ExportableExpense>): ExportableExpense => ({
  occurredOn: '2026-10-05',
  description: 'Riz au marché',
  payee: 'Marché Mokolo',
  categoryId: 'c-food',
  amountMinor: 5000,
  currency: 'XAF',
  isEstimated: false,
  attachmentCount: 1,
  source: 'manual',
  ...over,
});

const sample = [
  expense({}),
  expense({ occurredOn: '2026-10-06', description: 'Taxi', payee: null, categoryId: 'c-tx', amountMinor: 350, attachmentCount: 0 }),
  expense({ occurredOn: '2026-10-07', description: 'Beignets', categoryId: null, amountMinor: 500 }),
  expense({ occurredOn: '2026-10-08', description: 'Ticket', categoryId: 'c-tx', amountMinor: 1250, currency: 'EUR', isEstimated: true }),
];

describe('buildDataset', () => {
  const ds = buildDataset({ from: '2026-10-01', to: '2026-10-31', owner: 'Gaël', expenses: sample, categories, now: new Date('2026-10-10T12:00:00Z') });

  it('maps category names and keeps rows in input order', () => {
    expect(ds.rows.map((r) => r.category)).toEqual(['Food & Groceries', 'Transport', null, 'Transport']);
    expect(ds.rows[0]).toMatchObject({ date: '2026-10-05', payee: 'Marché Mokolo', proofs: 1, estimated: false });
  });

  it('totals per currency, most-used currency first', () => {
    expect(ds.byCurrency).toEqual([
      { currency: 'XAF', totalMinor: 5850, count: 3 },
      { currency: 'EUR', totalMinor: 1250, count: 1 },
    ]);
  });

  it('totals per category within each currency, largest first, uncategorised named', () => {
    expect(ds.byCategory).toEqual([
      { currency: 'XAF', category: 'Food & Groceries', totalMinor: 5000, count: 1 },
      { currency: 'XAF', category: 'Uncategorised', totalMinor: 500, count: 1 },
      { currency: 'XAF', category: 'Transport', totalMinor: 350, count: 1 },
      { currency: 'EUR', category: 'Transport', totalMinor: 1250, count: 1 },
    ]);
  });

  it('handles an empty range', () => {
    const empty = buildDataset({ from: '2026-01-01', to: '2026-01-31', owner: 'x', expenses: [], categories });
    expect(empty.rows).toEqual([]);
    expect(empty.byCurrency).toEqual([]);
    expect(empty.byCategory).toEqual([]);
  });
});

describe('buildXlsx', () => {
  const ds = buildDataset({ from: '2026-10-01', to: '2026-10-31', owner: 'Gaël', expenses: sample, categories, now: new Date('2026-10-10T12:00:00Z') });
  const wb = XLSX.read(buildXlsx(ds), { type: 'buffer' });

  it('writes one row per expense with the amount in major units', () => {
    expect(wb.SheetNames).toEqual(['Expenses', 'Summary']);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Expenses);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ Date: '2026-10-05', Description: 'Riz au marché', Category: 'Food & Groceries', Amount: 5000, Currency: 'XAF', Proofs: 1 });
    expect(rows[3]).toMatchObject({ Amount: 12.5, Currency: 'EUR', Estimated: 'yes' });
  });

  it('writes the totals on the summary sheet', () => {
    const cells = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Summary, { header: 1 });
    expect(cells).toContainEqual(['XAF', 5850, 3, expect.stringContaining('FCFA')]);
    expect(cells).toContainEqual(['Transport', 'EUR', 12.5, 1, expect.stringContaining('€')]);
  });
});

describe('buildPdf', () => {
  it('produces a valid PDF with the expected pages', async () => {
    const ds = buildDataset({ from: '2026-10-01', to: '2026-10-31', owner: 'Gaël', expenses: sample, categories, now: new Date('2026-10-10T12:00:00Z') });
    const bytes = await buildPdf(ds);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('xpens-ia expenses 2026-10-01 to 2026-10-31');
  });

  it('paginates long exports and survives characters outside Latin-1', async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      expense({ occurredOn: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, description: `Ligne ${i} — ₦ 😀 ndolé`, currency: i % 2 ? 'NGN' : 'XAF' }),
    );
    const ds = buildDataset({ from: '2026-10-01', to: '2026-10-31', owner: 'x', expenses: many, categories });
    const doc = await PDFDocument.load(await buildPdf(ds));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
