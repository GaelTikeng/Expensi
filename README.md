# xpens-ia

Mobile, AI-integrated expense tracker. Record expenses by hand, import Excel /
CSV / PDF statements and validate what the AI extracted, attach receipts as
proof, see daily / weekly / monthly recaps, plan upcoming expenses with
reminders, and keep fixed monthly charges in one place.

**Read [CLAUDE.md](./CLAUDE.md) first.** It holds the architecture decisions,
conventions, and the feature registry that tracks what is built and what is next.

## Stack

Expo (React Native, expo-router, API Routes) · Clerk · Neon Postgres · Drizzle ·
OpenAI SDK → TensorX · S3 · expo-notifications

```
Expo app ──Clerk JWT──> Expo API routes ──> Neon Postgres
    │                         ├──> TensorX (OpenAI SDK, custom baseURL)
    │                         └──> S3 (presigned URLs)
    └──presigned URL──────────────> S3
```

## Getting started

Requirements: Node 24, pnpm 9+, an Expo dev client (not Expo Go — Clerk and
notifications need native modules).

```bash
pnpm install
cp .env.example .env        # fill in Clerk, Neon, TensorX, S3 values
pnpm db:migrate             # applies src/server/db/migrations against DIRECT_URL
pnpm start                  # Metro + API routes
```

First native build:

```bash
npx expo prebuild
eas build --profile development --platform all
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint via `expo lint`; forbids client imports of `src/server` |
| `pnpm test` | Unit + component tests (Jest) |
| `pnpm test:integration` | API routes against the Neon test branch (`DATABASE_URL_TEST` in `.env`) |
| `pnpm test:e2e` | Real API over HTTP against a running server (`E2E_BASE_URL=http://localhost:8083`) |
| `pnpm db:generate` | Drizzle migration from `src/server/db/schema.ts` — read the SQL before committing |
| `pnpm db:migrate` | Apply migrations (direct Neon URL) |
| `pnpm db:studio` | Drizzle Studio |

## Layout

```
app/                 expo-router screens; app/api/**/*+api.ts are server routes
src/server/          server-only: db, repositories, auth, ai, storage, env
src/ai/              client-safe extraction contract + review gating
src/lib/             money, dates, api client
docs/                Neon and S3 operational notes
```

## Operational notes

- [docs/NEON_NOTES.md](./docs/NEON_NOTES.md) — pooled vs direct URL, autosuspend, region.
- [docs/S3_SETUP.md](./docs/S3_SETUP.md) — bucket, CORS, IAM policy.
