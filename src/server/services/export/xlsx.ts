import * as XLSX from 'xlsx';

import { formatDDMMYYYY } from '@/src/lib/dates';
import { major, money, type ExportDataset } from './dataset';

/**
 * E10 F10.2: two sheets. "Expenses" has one row per expense with the amount
 * as a plain number so it can be summed in Excel; "Summary" has totals per
 * currency and per category.
 */
export function buildXlsx(ds: ExportDataset): Buffer {
  const wb = XLSX.utils.book_new();

  const expenses = XLSX.utils.aoa_to_sheet([
    ['Date', 'Description', 'Paid to', 'Category', 'Amount', 'Currency', 'Estimated', 'Proofs', 'Source'],
    ...ds.rows.map((r) => [r.date, r.description, r.payee ?? '', r.category ?? '', major(r.amountMinor, r.currency), r.currency, r.estimated ? 'yes' : 'no', r.proofs, r.source]),
  ]);
  expenses['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 9 }, { wch: 10 }, { wch: 7 }, { wch: 10 }];
  // Keep dates as text (ISO) so they sort and parse the same everywhere.
  XLSX.utils.book_append_sheet(wb, expenses, 'Expenses');

  const summary = XLSX.utils.aoa_to_sheet([
    ['Export', `${formatDDMMYYYY(ds.from)} – ${formatDDMMYYYY(ds.to)}`],
    ['Owner', ds.owner],
    ['Generated', ds.generatedAt.toISOString().slice(0, 10)],
    [],
    ['Currency', 'Total', 'Expenses', 'Formatted'],
    ...ds.byCurrency.map((t) => [t.currency, major(t.totalMinor, t.currency), t.count, money(t.totalMinor, t.currency)]),
    [],
    ['Category', 'Currency', 'Total', 'Expenses', 'Formatted'],
    ...ds.byCategory.map((t) => [t.category, t.currency, major(t.totalMinor, t.currency), t.count, money(t.totalMinor, t.currency)]),
  ]);
  summary['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
