/**
 * Integration project: route handlers run against the Neon test branch with
 * the three external services replaced.
 * - Clerk: the `x-test-user` request header is the Clerk user id.
 * - S3: an in-memory object store.
 * - TensorX: `mockExtraction()` / `mockNarrative()` decide what the model says.
 */
import { migrate } from 'drizzle-orm/neon-http/migrator';

jest.setTimeout(30_000);

jest.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: async (request: Request) => {
      const userId = request.headers.get('x-test-user');
      return userId
        ? { isAuthenticated: true, toAuth: () => ({ userId }) }
        : { isAuthenticated: false, reason: 'no x-test-user header', toAuth: () => ({ userId: null }) };
    },
    users: {
      getUser: async (id: string) => ({
        id,
        fullName: `Test ${id}`,
        primaryEmailAddress: { emailAddress: `${id}@example.com` },
        hasImage: true,
        imageUrl: `https://img.clerk.test/${id}.png`,
      }),
      deleteUser: async () => undefined,
    },
  }),
}));

jest.mock('@/src/server/storage/s3', () => {
  const actual = jest.requireActual('@/src/server/storage/s3');
  const store = new Map<string, { body: Buffer; contentType: string }>();
  return {
    ...actual,
    __store: store,
    isStorageConfigured: () => true,
    presignPut: async ({ key, contentType }: { key: string; contentType: string }) => ({
      url: `https://s3.test/${key}?put`,
      expiresAt: new Date(Date.now() + 600_000),
    }),
    presignGet: async (key: string) => `https://s3.test/${key}?get`,
    headObject: async (key: string) => {
      const obj = store.get(key);
      if (!obj) throw new Error('NotFound');
      return { contentType: obj.contentType, contentLength: obj.body.length };
    },
    getObjectBuffer: async (key: string) => {
      const obj = store.get(key);
      if (!obj) throw new Error('NoSuchKey');
      return obj.body;
    },
    deleteObject: async (key: string) => {
      store.delete(key);
    },
    deletePrefix: async (prefix: string) => {
      for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
    },
  };
});

jest.mock('@/src/server/ai/client', () => {
  const actual = jest.requireActual('@/src/server/ai/client');
  const queue: unknown[] = [];
  const requests: unknown[] = [];
  return {
    ...actual,
    __aiQueue: queue,
    __aiRequests: requests,
    ai: {
      chat: {
        completions: {
          create: async (params: unknown) => {
            requests.push(params);
            const next = queue.shift();
            if (!next) throw new Error('No mocked model reply queued; call mockExtraction()/mockNarrative() first');
            if (next instanceof Error) throw next;
            return next;
          },
        },
      },
    },
  };
});

beforeAll(async () => {
  // Loaded here, not at the top: the env override in integration-env.ts must
  // run first. `require`, because Jest's CommonJS runtime cannot `import()`.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { db } = require('@/src/server/db/client') as typeof import('@/src/server/db/client');
  await migrate(db, { migrationsFolder: 'src/server/db/migrations' });
});
