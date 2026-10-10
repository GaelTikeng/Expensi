import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

import { formatDDMMYYYY } from '@/src/lib/dates';
import { money, type ExportDataset } from './dataset';

// A4 in points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const LINE = 14;
const BODY = 9;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);
const RULE = rgb(0.85, 0.85, 0.88);

// Columns: date | description (flexible) | paid to | category | amount (right-aligned).
const COLS = { date: 58, payee: 100, category: 88, amount: 92 } as const;
const DESC_W = PAGE_W - 2 * MARGIN - COLS.date - COLS.payee - COLS.category - COLS.amount;

/**
 * The standard Helvetica font only knows WinAnsi (Latin-1). Narrow spaces
 * from fr-FR number formatting, "₦" and anything outside that range would
 * throw at draw time, so swap them for safe equivalents first.
 */
function safe(s: string): string {
  return s.replace(/[  ]/g, ' ').replace(/₦/g, 'NGN ').replace(/[^\x20-\x7E¡-ÿ]/g, '?');
}

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

/** E10 F10.3: a printable statement — header, table with repeated column titles, totals, page numbers. */
export async function buildPdf(ds: ExportDataset): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`xpens-ia expenses ${ds.from} to ${ds.to}`);
  doc.setCreator('xpens-ia');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const x0 = MARGIN;
  const xDesc = x0 + COLS.date;
  const xPayee = xDesc + DESC_W;
  const xCat = xPayee + COLS.payee;
  const xAmountRight = PAGE_W - MARGIN;

  const text = (p: PDFPage, s: string, x: number, yy: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) =>
    p.drawText(safe(s), { x, y: yy, size: opts.size ?? BODY, font: opts.font ?? font, color: opts.color ?? INK });
  const right = (p: PDFPage, s: string, xRight: number, yy: number, f: PDFFont = font, size = BODY) =>
    text(p, s, xRight - f.widthOfTextAtSize(safe(s), size), yy, { font: f, size });

  const tableHeader = () => {
    text(page, 'Date', x0, y, { font: bold, color: MUTED });
    text(page, 'Description', xDesc, y, { font: bold, color: MUTED });
    text(page, 'Paid to', xPayee, y, { font: bold, color: MUTED });
    text(page, 'Category', xCat, y, { font: bold, color: MUTED });
    right(page, 'Amount', xAmountRight, y, bold);
    y -= 6;
    page.drawLine({ start: { x: x0, y }, end: { x: xAmountRight, y }, thickness: 0.6, color: RULE });
    y -= LINE;
  };
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    tableHeader();
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 20) newPage();
  };

  // Header.
  text(page, 'Expenses', x0, y - 8, { size: 20, font: bold });
  y -= 30;
  text(page, ds.owner, x0, y, { size: 10, color: MUTED });
  y -= LINE;
  text(page, `${formatDDMMYYYY(ds.from)} - ${formatDDMMYYYY(ds.to)}  ·  ${ds.rows.length} expense${ds.rows.length === 1 ? '' : 's'}  ·  generated ${formatDDMMYYYY(ds.generatedAt.toISOString().slice(0, 10))}`, x0, y, { size: 10, color: MUTED });
  y -= LINE * 1.8;
  tableHeader();

  // Rows.
  for (const r of ds.rows) {
    ensure(LINE);
    text(page, formatDDMMYYYY(r.date), x0, y);
    text(page, fit(r.description + (r.estimated ? ' (est.)' : ''), font, BODY, DESC_W - 6), xDesc, y);
    text(page, fit(r.payee ?? '', font, BODY, COLS.payee - 6), xPayee, y);
    text(page, fit(r.category ?? '', font, BODY, COLS.category - 6), xCat, y);
    right(page, money(r.amountMinor, r.currency), xAmountRight, y);
    y -= LINE;
  }
  if (ds.rows.length === 0) {
    text(page, 'No expenses in this period.', x0, y, { color: MUTED });
    y -= LINE;
  }

  // Totals.
  ensure(LINE * 3);
  y -= 4;
  page.drawLine({ start: { x: x0, y: y + 10 }, end: { x: xAmountRight, y: y + 10 }, thickness: 0.6, color: RULE });
  y -= 6;
  text(page, 'Totals', x0, y, { font: bold, size: 11 });
  y -= LINE;
  for (const t of ds.byCurrency) {
    ensure(LINE);
    text(page, `${t.count} expense${t.count === 1 ? '' : 's'} in ${t.currency}`, x0, y);
    right(page, money(t.totalMinor, t.currency), xAmountRight, y, bold);
    y -= LINE;
  }
  if (ds.byCategory.length) {
    ensure(LINE * 2);
    y -= 4;
    text(page, 'By category', x0, y, { font: bold, size: 11 });
    y -= LINE;
    for (const t of ds.byCategory) {
      ensure(LINE);
      text(page, fit(`${t.category}${ds.byCurrency.length > 1 ? ` (${t.currency})` : ''}`, font, BODY, DESC_W + COLS.date), x0, y);
      text(page, `${t.count}`, xCat, y, { color: MUTED });
      right(page, money(t.totalMinor, t.currency), xAmountRight, y);
      y -= LINE;
    }
  }

  // Footer with page numbers, once the count is known.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `xpens-ia  ·  page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8), y: MARGIN - 18, size: 8, font, color: MUTED });
  });

  return doc.save();
}
