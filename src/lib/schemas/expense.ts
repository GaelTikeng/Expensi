import { z } from 'zod';

import { isKnownCurrency } from '../currencies';

import { isValidISODate } from '../dates';

/**
 * Shared between the form (client) and the API routes (server), so a payload
 * that passes locally is accepted remotely. Keep this file free of server
 * imports.
 */

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isValidISODate, 'Not a real calendar date');

export const EXPENSE_SOURCES = ['manual', 'import', 'planned', 'recurring'] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

/** E16: a position is a pair; one coordinate alone is a client bug, not data. */
function bothCoordinatesOrNeither(v: { latitude?: number | null; longitude?: number | null }, ctx: z.RefinementCtx) {
  if (v.latitude === undefined && v.longitude === undefined) return;
  if ((v.latitude == null) !== (v.longitude == null)) {
    ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Both coordinates or neither' });
  }
}

const expenseFields = z.object({
  /** Client-generated UUID (v7). Makes POST idempotent. */
  id: z.string().uuid(),
  amountMinor: z.number().int().positive('Amount must be greater than zero'),
  currency: z.string().length(3).toUpperCase().refine((c): boolean => isKnownCurrency(c), 'Unsupported currency'),
  occurredOn: isoDateSchema,
  paidOn: isoDateSchema.nullable().optional(),
  description: z.string().trim().min(1, 'Description is required').max(500),
  payee: z.string().trim().max(200).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isEstimated: z.boolean().optional(),
  /** E16: optional GPS position; both coordinates or neither. */
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  locationLabel: z.string().trim().max(200).nullable().optional(),
});

export const expenseInputSchema = expenseFields.superRefine(bothCoordinatesOrNeither);
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const expensePatchSchema = expenseFields.omit({ id: true }).partial().strict().superRefine(bothCoordinatesOrNeither);
export type ExpensePatch = z.infer<typeof expensePatchSchema>;

export const expenseListQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  categoryId: z.string().uuid().optional(),
  source: z.enum(EXPENSE_SOURCES).optional(),
  /** Free-text search over description and payee. */
  q: z.string().trim().min(1).max(100).optional(),
  /** true = only expenses with at least one proof file; false = only without. */
  hasAttachment: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

/** Wire shape of an expense as returned by the API. */
export interface ExpenseDto {
  id: string;
  amountMinor: number;
  currency: string;
  occurredOn: string;
  paidOn: string | null;
  description: string;
  payee: string | null;
  categoryId: string | null;
  notes: string | null;
  source: ExpenseSource;
  isEstimated: boolean;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  importItemId: string | null;
  recurringChargeId: string | null;
  /** Confirmed proof files linked to this expense. */
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  items: ExpenseDto[];
  /** Pass as `offset` to fetch the next page; null when exhausted. */
  nextOffset: number | null;
}
