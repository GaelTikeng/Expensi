import { z } from 'zod';

import type { LineKind } from '@/src/ai/extraction-contract';
import { isoDateSchema } from './expense';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export const IMPORT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
  'application/pdf',
] as const;
export type ImportMime = (typeof IMPORT_MIME_TYPES)[number];

export type ImportSourceType = 'xlsx' | 'csv' | 'pdf_text' | 'pdf_scan';
export type ImportStatus = 'queued' | 'processing' | 'review' | 'committed' | 'failed';
export type ReviewState = 'pending' | 'accepted' | 'edited' | 'rejected';

export function sourceTypeForMime(mime: string, filename?: string | null): ImportSourceType {
  if (mime === 'application/pdf') return 'pdf_text';
  if (mime === 'text/csv' || mime === 'text/comma-separated-values') return 'csv';
  if (/\.csv$/i.test(filename ?? '')) return 'csv';
  return 'xlsx';
}

export const importPresignSchema = z.object({
  id: z.string().uuid(),
  mimeType: z.enum(IMPORT_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_IMPORT_BYTES),
  originalFilename: z.string().trim().max(255).optional(),
});

export const importCreateSchema = z.object({
  id: z.string().uuid(),
  storageKey: z.string().min(1),
  mimeType: z.enum(IMPORT_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_IMPORT_BYTES),
  originalFilename: z.string().trim().max(255).optional(),
});
export type ImportCreate = z.infer<typeof importCreateSchema>;

export const importItemPatchSchema = z
  .object({
    amountMinor: z.number().int().positive().nullable().optional(),
    currency: z.string().length(3).toUpperCase().optional(),
    occurredOn: isoDateSchema.nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    payee: z.string().trim().max(200).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    lineKind: z.enum(['expense', 'total', 'subtotal', 'header', 'struck_through', 'illegible']).optional(),
    reviewState: z.enum(['pending', 'accepted', 'edited', 'rejected']).optional(),
  })
  .strict();
export type ImportItemPatch = z.infer<typeof importItemPatchSchema>;

export const importCommitSchema = z.object({
  /** Items the user ticked. Everything else is marked rejected. */
  acceptedItemIds: z.array(z.string().uuid()).min(1).max(1000),
});

export interface ImportDto {
  id: string;
  sourceType: ImportSourceType;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  pageCount: number;
  status: ImportStatus;
  failureReason: string | null;
  attemptCount: number;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  detectedCurrency: string | null;
  detectedLanguage: string | null;
  documentQuality: string | null;
  committedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses. */
  itemCount?: number;
}

export interface ImportItemDto {
  id: string;
  importId: string;
  lineIndex: number;
  rawText: string;
  amountMinor: number | null;
  currency: string | null;
  occurredOn: string | null;
  description: string | null;
  payee: string | null;
  categoryGuess: string | null;
  categoryId: string | null;
  confidence: number | null;
  ambiguityNote: string | null;
  lineKind: LineKind;
  reviewState: ReviewState;
  editedByUser: boolean;
  /** Existing expense with the same amount and date, if any (computed). */
  possibleDuplicateOf: { id: string; description: string } | null;
}

export interface ImportDetailResponse {
  import: ImportDto;
  items: ImportItemDto[];
  reconciliation: {
    statedTotalMinor: number | null;
    computedTotalMinor: number;
    discrepancyMinor: number | null;
  };
}
