/** The e2e project talks to a running server; it needs the real Clerk and Neon settings from .env. */
import 'dotenv/config';

for (const name of ['CLERK_SECRET_KEY', 'DATABASE_URL']) {
  if (!process.env[name]) throw new Error(`${name} is not set; the e2e tests need the real .env.`);
}
process.env.E2E_BASE_URL ??= 'http://localhost:8081';
