import { t } from './index';

/**
 * E14: form errors come from the translations, keyed by field, instead of the
 * shared zod schemas' English messages (which stay as API documentation).
 */
const FIELD_MESSAGE = {
  amountMinor: 'validation.amount',
  description: 'validation.descriptionRequired',
  title: 'validation.titleRequired',
  name: 'validation.nameRequired',
  occurredOn: 'validation.date',
  paidOn: 'validation.date',
  scheduledAt: 'validation.date',
  startsOn: 'validation.date',
  endsOn: 'validation.date',
  reminderTime: 'validation.time',
  dayOfMonth: 'validation.dayOfMonth',
  currency: 'validation.currency',
} as const;

export function fieldError(field: string): string {
  const key = FIELD_MESSAGE[field as keyof typeof FIELD_MESSAGE];
  return key ? t(key) : t('validation.invalid');
}

/** `{ field: message }` for every issue zod reported, first issue per field wins. */
export function fieldErrors(issues: readonly { path: readonly PropertyKey[] }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    if (!(field in out)) out[field] = fieldError(field);
  }
  return out;
}
