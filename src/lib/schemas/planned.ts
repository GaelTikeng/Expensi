import { z } from 'zod';

import { isoDateSchema } from './expense';

export type PlannedStatus = 'planned' | 'done' | 'skipped';

const isoDateTime = z.string().datetime({ offset: true });

export const plannedInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  amountMinor: z.number().int().positive('Amount must be greater than zero'),
  currency: z.string().length(3).toUpperCase(),
  /** ISO instant; the moment the expense is meant to happen. */
  scheduledAt: isoDateTime,
  place: z.string().trim().max(200).nullable().optional(),
  reason: z.string().trim().max(2000).nullable().optional(),
  payee: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});
export type PlannedInput = z.infer<typeof plannedInputSchema>;

export const plannedPatchSchema = plannedInputSchema
  .omit({ id: true })
  .extend({ status: z.enum(['planned', 'skipped']).optional() })
  .partial()
  .strict();
export type PlannedPatch = z.infer<typeof plannedPatchSchema>;

/** F5.6: what actually happened when the user marks it done. */
export const plannedCompleteSchema = z.object({
  /** Actual amount; defaults to the planned amount. */
  amountMinor: z.number().int().positive().optional(),
  /** Defaults to the scheduled date in the user's timezone. */
  occurredOn: isoDateSchema.optional(),
  paidOn: isoDateSchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  /** Already-uploaded, unlinked attachments to attach to the new expense (F2b.8). */
  attachmentIds: z.array(z.string().uuid()).max(10).optional(),
});
export type PlannedComplete = z.infer<typeof plannedCompleteSchema>;

export const plannedListQuerySchema = z.object({
  status: z.enum(['planned', 'done', 'skipped', 'all']).default('planned'),
  /** Inclusive bounds on scheduledAt (ISO instants or dates). */
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PlannedListQuery = z.infer<typeof plannedListQuerySchema>;

export interface PlannedDto {
  id: string;
  title: string;
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  scheduledAt: string;
  place: string | null;
  reason: string | null;
  payee: string | null;
  notes: string | null;
  status: PlannedStatus;
  completedExpenseId: string | null;
  completedAt: string | null;
  recurringChargeId: string | null;
  periodStart: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedMonthSummary {
  /** YYYY-MM */
  month: string;
  currency: string;
  plannedMinor: number;
  doneMinor: number;
  skippedMinor: number;
  plannedCount: number;
  doneCount: number;
  skippedCount: number;
}
