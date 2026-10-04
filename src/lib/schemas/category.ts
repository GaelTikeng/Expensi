import { z } from 'zod';

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  /** Ionicons glyph name. */
  icon: z.string().max(64).nullable().optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB')
    .nullable()
    .optional(),
  /** One level of nesting only; the server rejects grandchildren. */
  parentId: z.string().uuid().nullable().optional(),
  budgetMinor: z.number().int().nonnegative().nullable().optional(),
  budgetCurrency: z.string().length(3).toUpperCase().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryPatchSchema = categoryInputSchema.partial().strict();
export type CategoryPatch = z.infer<typeof categoryPatchSchema>;

export interface CategoryDto {
  id: string;
  name: string;
  icon: string | null;
  colorHex: string | null;
  parentId: string | null;
  budgetMinor: number | null;
  budgetCurrency: string | null;
  sortOrder: number;
}
