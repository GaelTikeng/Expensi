import { z } from 'zod';

import { isoDateSchema } from './expense';

/** E10: one export is at most this many rows; ask the user to narrow the range beyond it. */
export const EXPORT_MAX_ROWS = 5000;
/** …and at most this many days wide (two years). */
export const EXPORT_MAX_DAYS = 731;

export const EXPORT_FORMATS = ['pdf', 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const exportQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  /** `summary` returns counts and totals as JSON for the preview line. */
  format: z.enum([...EXPORT_FORMATS, 'summary']),
  categoryId: z.string().uuid().optional(),
  hasAttachment: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

export interface ExportSummary {
  count: number;
  byCurrency: { currency: string; totalMinor: number; count: number }[];
}

export const EXPORT_MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function exportFilename(from: string, to: string, format: ExportFormat): string {
  return `xpens-ia_${from}_${to}.${format}`;
}
