import { json, withAuth } from '@/src/server/auth/clerk';

/** Smoke test for the auth middleware: returns the resolved `users` row. */
export const GET = withAuth(async (_req, { user }) =>
  json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    defaultCurrency: user.defaultCurrency,
    timezone: user.timezone,
  }),
);
