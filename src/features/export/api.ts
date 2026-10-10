import { apiBaseUrl, apiFetch } from '@/src/lib/api';
import type { ExportFormat, ExportSummary } from '@/src/lib/schemas/export';

type GetToken = () => Promise<string | null>;

export interface ExportRange {
  from: string;
  to: string;
  categoryId?: string;
  hasAttachment?: boolean;
}

function qs(range: ExportRange, format: ExportFormat | 'summary'): string {
  const sp = new URLSearchParams({ from: range.from, to: range.to, format });
  if (range.categoryId) sp.set('categoryId', range.categoryId);
  if (range.hasAttachment !== undefined) sp.set('hasAttachment', String(range.hasAttachment));
  return sp.toString();
}

export const exportPath = (range: ExportRange, format: ExportFormat | 'summary') => `/api/expenses/export?${qs(range, format)}`;
export const exportUrl = (range: ExportRange, format: ExportFormat) => `${apiBaseUrl()}${exportPath(range, format)}`;

export function exportApi(getToken: GetToken) {
  return {
    summary: (range: ExportRange) => apiFetch<ExportSummary>(exportPath(range, 'summary'), getToken),
  };
}
