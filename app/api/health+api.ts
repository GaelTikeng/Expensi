/**
 * Liveness probe. Deliberately imports nothing from src/server so it answers
 * even when env is misconfigured; that makes "the route works but the env is
 * wrong" distinguishable from "the route isn't deployed".
 */
export function GET() {
  return Response.json({ ok: true, service: 'xpens-ia', time: new Date().toISOString() });
}
