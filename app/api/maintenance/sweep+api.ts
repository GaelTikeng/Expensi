import { env } from '@/src/server/env';
import { sweepStaleUploads } from '@/src/server/services/maintenance';

/**
 * Cron target (see docs/DEPLOY.md §3). Not a user route: authenticated by a
 * shared secret header, disabled entirely when MAINTENANCE_SECRET is unset.
 */
export async function POST(request: Request) {
  if (!env.MAINTENANCE_SECRET) return new Response('maintenance disabled', { status: 404 });
  const provided = request.headers.get('x-maintenance-secret');
  if (!provided || provided !== env.MAINTENANCE_SECRET) return new Response('forbidden', { status: 403 });
  const result = await sweepStaleUploads();
  return Response.json({ ok: true, ...result, at: new Date().toISOString() });
}
