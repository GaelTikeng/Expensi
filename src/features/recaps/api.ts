import { apiFetch } from '@/src/lib/api';
import type { RecapPeriod } from '@/src/lib/dates';
import type { RecapDto, RecapOverview } from '@/src/lib/schemas/recap';

type GetToken = () => Promise<string | null>;

export function recapsApi(getToken: GetToken) {
  return {
    get: (period: RecapPeriod, start: string, narrative: boolean) =>
      apiFetch<{ recap: RecapDto }>(`/api/recaps?period=${period}&start=${start}&narrative=${narrative ? 1 : 0}`, getToken).then((r) => r.recap),
    overview: () => apiFetch<RecapOverview>('/api/recaps/overview', getToken),
  };
}
