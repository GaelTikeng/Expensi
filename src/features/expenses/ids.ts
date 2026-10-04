import * as Crypto from 'expo-crypto';

import { uuidv7 } from '@/src/lib/uuid';

/** New client-side id for an expense, import or planned expense (D9). */
export function newId(): string {
  return uuidv7(Crypto.getRandomBytes(10));
}
