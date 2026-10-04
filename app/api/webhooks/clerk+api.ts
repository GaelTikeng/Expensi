import { verifyWebhook } from '@clerk/backend/webhooks';

import { db } from '@/src/server/db/client';
import { UsersRepository } from '@/src/server/repositories/users';
import { deleteAccountData } from '@/src/server/services/account';

/**
 * Clerk → us. Verified with the Standard Webhooks signature using
 * CLERK_WEBHOOK_SIGNING_SECRET (read by verifyWebhook from env).
 *
 * Idempotent by construction: a `user.deleted` for an unknown user is a 200
 * no-op, and `user.updated` is an upsert.
 */
export async function POST(request: Request) {
  let evt;
  try {
    evt = await verifyWebhook(request);
  } catch (err) {
    console.error('Clerk webhook verification failed', err);
    return new Response('invalid signature', { status: 400 });
  }

  const usersRepo = new UsersRepository(db);

  switch (evt.type) {
    case 'user.deleted': {
      const clerkUserId = evt.data.id;
      if (!clerkUserId) break;
      const user = await usersRepo.findByClerkId(clerkUserId);
      if (user) await deleteAccountData(user);
      break;
    }
    case 'user.created':
    case 'user.updated': {
      const primary = evt.data.email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id,
      );
      const fullName = [evt.data.first_name, evt.data.last_name].filter(Boolean).join(' ');
      await usersRepo.upsertFromClerk({
        clerkUserId: evt.data.id,
        email: primary?.email_address ?? null,
        displayName: fullName || null,
      });
      break;
    }
    default:
      // Unhandled event types are acknowledged so Clerk stops retrying them.
      break;
  }

  return new Response('ok', { status: 200 });
}
