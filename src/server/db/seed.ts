/**
 * Seeds reference data. Idempotent — safe to re-run.
 *
 *   pnpm db:seed
 */
import 'dotenv/config';

import { db } from './client';
import { currencies } from './schema';

const CURRENCIES = [
  { code: 'XAF', exponent: 0, symbol: 'FCFA', name: 'Central African CFA franc' },
  { code: 'XOF', exponent: 0, symbol: 'CFA', name: 'West African CFA franc' },
  { code: 'EUR', exponent: 2, symbol: '€', name: 'Euro' },
  { code: 'USD', exponent: 2, symbol: '$', name: 'US dollar' },
  { code: 'GBP', exponent: 2, symbol: '£', name: 'Pound sterling' },
  { code: 'NGN', exponent: 2, symbol: '₦', name: 'Nigerian naira' },
] as const;

async function main() {
  await db.insert(currencies).values([...CURRENCIES]).onConflictDoNothing();
  console.log(`Seeded ${CURRENCIES.length} currencies.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
