import { json, withAuth } from '@/src/server/auth/clerk';
import { db } from '@/src/server/db/client';
import { ReferenceRepository } from '@/src/server/repositories/reference';

/** Reference currencies for pickers. Authenticated to keep the API surface uniform. */
export const GET = withAuth(async () => {
  const currencies = await new ReferenceRepository(db).listCurrencies();
  return json({ currencies });
});
