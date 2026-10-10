/**
 * Calls an Expo API Route handler the way the runtime does: a `Request` plus
 * the route params from the file name. `user` becomes the Clerk user id the
 * mocked `authenticateRequest` reports (see tests/setup/integration.ts).
 */
export type Handler = (request: Request, params?: Record<string, string>) => Promise<Response> | Response;

export interface ApiResult<T = any> {
  status: number;
  json: T;
  headers: Headers;
  bytes: () => Promise<Buffer>;
}

export const TEST_USER = 'user_test_main';

export async function call<T = any>(
  handler: Handler,
  method: string,
  path: string,
  opts: { body?: unknown; user?: string | null; params?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  const user = opts.user === undefined ? TEST_USER : opts.user;
  if (user) headers['x-test-user'] = user;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const request = new Request(`http://test.local${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handler(request, opts.params ?? {});
  const clone = res.clone();
  let json: T = null as T;
  if ((res.headers.get('content-type') ?? '').includes('application/json')) {
    json = (await res.json().catch(() => null)) as T;
  }
  return { status: res.status, json, headers: res.headers, bytes: () => clone.arrayBuffer().then((b) => Buffer.from(b)) };
}

/** Queue one model reply (OpenAI chat-completion shape) for the next AI call. */
export function mockModelReply(reply: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/src/server/ai/client') as { __aiQueue: unknown[] };
  mod.__aiQueue.push(reply);
}

/** A tool-call reply carrying the extraction result, as TensorX returns it. */
export function extractionReply(result: unknown, usage = { prompt_tokens: 100, completion_tokens: 50 }) {
  return {
    model: 'z-ai/glm-5.3-flash',
    usage,
    choices: [
      {
        finish_reason: 'tool_calls',
        message: { tool_calls: [{ type: 'function', function: { name: 'recordExpenseLines', arguments: JSON.stringify(result) } }] },
      },
    ],
  };
}

/** Put bytes into the mocked S3 store, as a direct PUT would. */
export function putObject(key: string, body: Buffer, contentType: string): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/src/server/storage/s3') as { __store: Map<string, { body: Buffer; contentType: string }> };
  mod.__store.set(key, { body, contentType });
}

export function hasObject(key: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/src/server/storage/s3') as { __store: Map<string, unknown> };
  return mod.__store.has(key);
}
