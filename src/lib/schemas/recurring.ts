import { z } from 'zod';

import { isKnownCurrency } from '../currencies';

import { isoDateSchema } from './expense';
import type { PlannedStatus } from './planned';

export const recurringInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  amountMinor: z.number().int().positive('Amount must be greater than zero'),
  currency: z.string().length(3).toUpperCase().refine((c): boolean => isKnownCurrency(c), 'Unsupported currency'),
  categoryId: z.string().uuid().nullable().optional(),
  payee: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31),
  /** "HH:MM" local time in the user's timezone. */
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM').default('09:00'),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});
export type RecurringInput = z.infer<typeof recurringInputSchema>;

export const recurringPatchSchema = recurringInputSchema.omit({ id: true }).partial().strict();
export type RecurringPatch = z.infer<typeof recurringPatchSchema>;

export interface RecurringDto {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  payee: string | null;
  notes: string | null;
  dayOfMonth: number;
  reminderTime: string;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** The materialised row for the current month, if any (F6.4). */
  currentMonth: { plannedId: string; status: PlannedStatus; scheduledAt: string } | null;
}
