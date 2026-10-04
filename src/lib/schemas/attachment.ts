import { z } from 'zod';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'] as const;
export type AttachmentMime = (typeof ATTACHMENT_MIME_TYPES)[number];

export type AttachmentKind = 'photo' | 'pdf';

export function kindForMime(mime: string): AttachmentKind {
  return mime === 'application/pdf' ? 'pdf' : 'photo';
}

export const presignRequestSchema = z.object({
  /** Client-generated UUID so a retried presign re-signs the same object key. */
  id: z.string().uuid(),
  mimeType: z.enum(ATTACHMENT_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
  originalFilename: z.string().trim().max(255).optional(),
  /** Optional at presign time: the create flow uploads before the expense exists. */
  expenseId: z.string().uuid().optional(),
});
export type PresignRequest = z.infer<typeof presignRequestSchema>;

export interface PresignResponse {
  id: string;
  key: string;
  uploadUrl: string;
  expiresAt: string;
}

export const confirmRequestSchema = z.object({
  id: z.string().uuid(),
  expenseId: z.string().uuid().nullable().optional(),
});
export type ConfirmRequest = z.infer<typeof confirmRequestSchema>;

export interface AttachmentDto {
  id: string;
  expenseId: string | null;
  kind: AttachmentKind;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
  uploadedAt: string | null;
  createdAt: string;
  /** Short-lived presigned GET; present on list responses. */
  url?: string;
  urlExpiresAt?: string;
}
