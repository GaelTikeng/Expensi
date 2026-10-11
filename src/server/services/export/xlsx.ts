import * as XLSX from 'xlsx';

import { formatDDMMYYYY } from '@/src/lib/dates';
import { major, money, type ExportDataset } from './dataset';
import type { TFunction } from 'i18next';
import { i18n } from '@/src/i18n';

/**
 * E10 F10.2: two sheets. "Expenses" has one row per expense with the amount
 * as a plain number so it can be summed in Excel; "Summary" has totals per
 * currency and per category.
 */
export function buildXlsx(ds: ExportDataset): Buffer {
  const t = i18n.getFixedT(ds.language);
  const wb = XLSX.utils.book_new();

  const expenses = XLSX.utils.aoa_to_sheet([
    [
      t('exportFile.date'),
      t('exportFile.description'),
      t('exportFile.payee'),
      t('exportFile.category'),
      t('exportFile.amount'),
      t('exportFile.currency'),
      t('exportFile.estimated'),
      t('exportFile.proofs'),
      t('exportFile.source'),
    ],
    ...ds.rows.map((r) => [
      r.date,
      r.description,
      r.payee ?? '',
      r.category ?? '',
      major(r.amountMinor, r.currency),
      r.currency,
      r.estimated ? t('exportFile.yes') : t('exportFile.no'),
      r.proofs,
      sourceLabel(t, r.source),
    ]),
  ]);
  expenses['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 9 }, { wch: 10 }, { wch: 7 }, { wch: 10 }];
  // Keep dates as text (ISO) so they sort and parse the same everywhere.
  XLSX.utils.book_append_sheet(wb, expenses, t('exportFile.sheetExpenses'));

  const summary = XLSX.utils.aoa_to_sheet([
    [t('exportFile.export'), `${formatDDMMYYYY(ds.from)} – ${formatDDMMYYYY(ds.to)}`],
    [t('exportFile.owner'), ds.owner],
    [t('exportFile.generated'), ds.generatedAt.toISOString().slice(0, 10)],
    [],
    [t('exportFile.currency'), t('exportFile.total'), t('exportFile.expenses'), t('exportFile.formatted')],
    ...ds.byCurrency.map((t) => [t.currency, major(t.totalMinor, t.currency), t.count, money(t.totalMinor, t.currency)]),
    [],
    [t('exportFile.category'), t('exportFile.currency'), t('exportFile.total'), t('exportFile.expenses'), t('exportFile.formatted')],
    ...ds.byCategory.map((t) => [t.category, t.currency, major(t.totalMinor, t.currency), t.count, money(t.totalMinor, t.currency)]),
  ]);
  summary['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summary, t('exportFile.sheetSummary'));

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function sourceLabel(t: TFunction, source: string): string {
  const key = `exportFile.sources.${source}`;
  return i18n.exists(key) ? t(key as 'exportFile.sources.manual') : source;
}
