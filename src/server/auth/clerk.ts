import { createClerkClient } from '@clerk/backend';

import { db } from '../db/client';
import type { User } from '../db/schema';
import { env } from '../env';
import { HttpError } from '../errors';
import { CategoriesRepository, createRepositories, UsersRepository, type Repositories } from '../repositories';

export const clerk = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

export interface AuthedContext {
  user: User;
  clerkUserId: string;
  repos: Repositories;
}

/** Route params come from the file name, e.g. `[id]+api.ts` → `{ id }`. */
export type RouteParams = Record<string, string>;

export type AuthedHandler = (
  request: Request,
  ctx: AuthedContext,
  params: RouteParams,
) => Promise<Response> | Response;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

/**
 * Wraps an Expo API Route handler. Verifies the Clerk session token from the
 * Authorization header, upserts the `users` row on first sight (seeding the
 * default categories), hands the handler repositories already scoped to that
 * user, and maps thrown HttpErrors to JSON responses.
 *
 *   export const GET = withAuth(async (req, { repos }) => json(await repos.expenses.list(q)));
 */
export function withAuth(handler: AuthedHandler) {
  return async (request: Request, params: RouteParams = {}): Promise<Response> => {
    try {
      const result = await clerk.authenticateRequest(request, { acceptsToken: 'session_token' });
      if (!result.isAuthenticated) {
        return json({ error: 'unauthenticated', reason: result.reason }, { status: 401 });
      }
      const auth = result.toAuth();
      const clerkUserId = auth.userId;
      if (!clerkUserId) return json({ error: 'unauthenticated' }, { status: 401 });

      const usersRepo = new UsersRepository(db);
      let user = await usersRepo.findByClerkId(clerkUserId);
      if (!user) {
        const profile = await clerk.users.getUser(clerkUserId);
        user = await usersRepo.upsertFromClerk({
          clerkUserId,
          email: profile.primaryEmailAddress?.emailAddress ?? null,
          displayName: profile.fullName ?? null,
        });
        await new CategoriesRepository(db, user.id).seedDefaults();
      }

      return await handler(request, { user, clerkUserId, repos: createRepositories(db, user.id) }, params);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.code, message: err.message, details: err.details }, { status: err.status });
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}`, err);
      return json({ error: 'internal_error' }, { status: 500 });
    }
  };
}

/** Parses a JSON body, returning null on malformed input instead of throwing. */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

/** `URLSearchParams` → plain object, dropping empty values so zod defaults apply. */
export function queryObject(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams) if (v !== '') out[k] = v;
  return out;
}
