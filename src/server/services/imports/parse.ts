import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

import type { ImportSourceType } from '@/src/lib/schemas/import';

/** What the AI step receives. */
export type ParsedSource =
  | { kind: 'table'; text: string; rowCount: number; sheetName: string }
  | { kind: 'text'; text: string; pageCount: number }
  | { kind: 'scan'; pdf: Buffer; pageCount: number };

const MAX_ROWS = 500;
const MAX_TEXT_CHARS = 60_000;
/** Below this many extracted characters per page, the PDF is treated as scanned. */
const MIN_CHARS_PER_PAGE = 40;

/**
 * Spreadsheet → tab-separated text. Takes the sheet with the most rows (bank
 * exports often have a cover sheet). Dates come through as ISO strings via
 * `cellDates` + `raw:false` so the model sees real dates, not serials.
 */
export function parseSpreadsheet(buffer: Buffer): ParsedSource {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: true });
  let best: { name: string; rows: unknown[][] } | null = null;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', blankrows: false, defval: '' });
    if (!best || rows.length > best.rows.length) best = { name, rows };
  }
  if (!best || best.rows.length === 0) throw new Error('The spreadsheet has no rows');

  const rows = best.rows.slice(0, MAX_ROWS);
  const text = rows
    .map((r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ').trim()).join('\t'))
    .join('\n')
    .slice(0, MAX_TEXT_CHARS);
  return { kind: 'table', text, rowCount: rows.length, sheetName: best.name };
}

export async function parsePdf(buffer: Buffer): Promise<ParsedSource> {
  const result = await pdfParse(buffer);
  const pageCount = result.numpages || 1;
  const text = result.text?.trim() ?? '';
  if (text.length < MIN_CHARS_PER_PAGE * pageCount) {
    return { kind: 'scan', pdf: buffer, pageCount };
  }
  return { kind: 'text', text: text.slice(0, MAX_TEXT_CHARS), pageCount };
}

export async function parseSource(sourceType: ImportSourceType, buffer: Buffer): Promise<ParsedSource> {
  switch (sourceType) {
    case 'xlsx':
    case 'csv':
      return parseSpreadsheet(buffer);
    case 'pdf_text':
    case 'pdf_scan':
      return parsePdf(buffer);
  }
}
