import { json, queryObject, withAuth } from '@/src/server/auth/clerk';
import { buildDataset } from '@/src/server/services/export/dataset';
import { buildPdf } from '@/src/server/services/export/pdf';
import { buildXlsx } from '@/src/server/services/export/xlsx';
import { parseISODate } from '@/src/lib/dates';
import { EXPORT_MAX_DAYS, EXPORT_MAX_ROWS, EXPORT_MIME, exportFilename, exportQuerySchema, type ExportSummary } from '@/src/lib/schemas/export';

/**
 * E10 F10.1: the ledger for a date range as a spreadsheet or a PDF statement,
 * or (`format=summary`) the count and totals the export screen previews.
 */
export const GET = withAuth(async (req, { user, repos }) => {
  const parsed = exportQuerySchema.safeParse(queryObject(req));
  if (!parsed.success) return json({ error: 'invalid_query', issues: parsed.error.issues }, { status: 400 });
  const q = parsed.data;

  if (q.from > q.to) return json({ error: 'reversed_range', message: 'The start date is after the end date.' }, { status: 400 });
  const days = (parseISODate(q.to).getTime() - parseISODate(q.from).getTime()) / 86_400_000 + 1;
  if (days > EXPORT_MAX_DAYS) return json({ error: 'range_too_long', message: 'Export at most two years at a time.' }, { status: 400 });

  const { items, truncated } = await repos.expenses.listRange({ from: q.from, to: q.to, categoryId: q.categoryId, hasAttachment: q.hasAttachment }, EXPORT_MAX_ROWS);
  if (truncated) return json({ error: 'too_many_rows', message: `More than ${EXPORT_MAX_ROWS} expenses; narrow the range.` }, { status: 400 });

  const categories = await repos.categories.list();
  const ds = buildDataset({ from: q.from, to: q.to, owner: user.displayName ?? user.email ?? 'xpens-ia', expenses: items, categories });

  if (q.format === 'summary') {
    const body: ExportSummary = { count: ds.rows.length, byCurrency: ds.byCurrency };
    return json(body);
  }

  const body = q.format === 'xlsx' ? buildXlsx(ds) : await buildPdf(ds);
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': EXPORT_MIME[q.format],
      'content-disposition': `attachment; filename="${exportFilename(q.from, q.to, q.format)}"`,
      'cache-control': 'no-store',
    },
  });
});
