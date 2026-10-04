import { enqueue } from '@/src/features/attachments/queue';
import { stageFile, uploadStaged } from '@/src/features/attachments/upload';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import type { plannedApi } from './api';
import { cancelFor } from './reminders';
import type { CompleteValues } from './CompleteSheet';

type GetToken = () => Promise<string | null>;

/**
 * Shared by the list and the detail screen: complete the plan, cancel its
 * reminders, then upload any receipt against the new expense (parking
 * failures in the offline queue).
 */
export async function completePlan(api: ReturnType<typeof plannedApi>, plan: PlannedDto, values: CompleteValues, getToken: GetToken) {
  const res = await api.complete(plan.id, { amountMinor: values.amountMinor, occurredOn: values.occurredOn });
  await cancelFor(plan.id);
  let parked = 0;
  for (const f of values.files) {
    try {
      const staged = await stageFile(f);
      try {
        await uploadStaged(staged, { expenseId: res.expenseId, getToken });
      } catch (err) {
        await enqueue(staged, res.expenseId, err);
        parked++;
      }
    } catch {
      // unreadable file: skip silently; the expense itself is saved
    }
  }
  return { ...res, parked };
}
