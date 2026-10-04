import { createClerkClient } from '@clerk/backend';

import { db } from '../db/client';
import type { User } from '../db/schema';
import { env } from '../env';
import { createRepositories, UsersRepository, type Repositories } from '../repositories';

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export interface AuthedContext {
  user: User;
  clerkUserId: string;
  repos: Repositories;
}

export type AuthedHandler = (request: Request, ctx: AuthedContext) => Promise<Response> | Response;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

/**
 * Wraps an Expo API Route handler. Verifies the Clerk session token from the
 * Authorization header, upserts the `users` row on first sight, and hands the
 * handler a set of repositories already scoped to that user.
 *
 *   export const GET = withAuth(async (req, { repos }) => json(await repos.expenses.list()));
 */
export function withAuth(handler: AuthedHandler) {
  return async (request: Request): Promise<Response> => {
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
    }

    return handler(request, { user, clerkUserId, repos: createRepositories(db, user.id) });
  };
}
