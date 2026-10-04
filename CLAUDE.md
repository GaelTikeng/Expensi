# CLAUDE.md — Expense Tracker

Single source of truth for **what this project is, how it is built, and which
features exist, are in progress, or are planned**. Claude Code reads it every
session. Humans read it before touching anything.

**Rule for every contributor (human or AI):** when a feature ships, flip its
checkbox in the Feature Registry and add a Changelog line in the same commit. When
you decide to build something new, register it first. The registry never lags the
code.

Scope redefined: 2026-10-04 (v2). Previous scope (Firebase + Hono + Anthropic +
camera-first) is retired; see section 9 for what carried over.

---

## 1. Product

A mobile, AI-integrated expense tracker. Users record what they spend, import
spreadsheets or PDFs of expenses and validate what the AI extracted, see daily /
weekly / monthly recaps, plan expenses ahead of time and get reminded, and keep a
list of fixed monthly charges.

Target users: Central Africa first (XAF / FCFA, French-language documents), but
the design must not hard-code that. iOS + Android, public app.

---

## 2. Architecture

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | **Expo SDK 57** (React Native 0.86, React 19.2, expo-router 57, custom dev client) | file-based routing under `app/`; TypeScript 6 |
| Package manager | **pnpm** with `node-linker=hoisted` (`.npmrc`) | Metro needs a flat `node_modules` |
| Server layer | **Expo API Routes** (`app/api/**/*+api.ts`), deployed with EAS Hosting | keeps secrets off-device without a second repo; see Decision D1 |
| Auth | **Clerk** (`@clerk/clerk-expo`) | Clerk JWT verified server-side; `users.clerk_user_id` is the tenant key |
| Database | **Neon Postgres** | `@neondatabase/serverless`, neon-http driver |
| ORM | **Drizzle** (`pg-core`), server-side only | migrations with drizzle-kit |
| AI | **OpenAI SDK** (`openai` npm) with `baseURL: https://api.tensorx.ai/v1` and `TENSORX_API_KEY` | same pattern as the dorti project; called only from API routes; models via `GET /v1/models` |
| File storage | **S3** (or S3-compatible) via `@aws-sdk/client-s3` + presigned URLs | proof attachments (photo, PDF) and import uploads; private bucket, never public URLs |
| Push / reminders | `expo-notifications` local scheduling + Expo Push for server-triggered | see D4 |
| File parsing | SheetJS (`xlsx`) for Excel/CSV, `pdf-parse` for text PDFs, multimodal TensorX model for scanned PDFs | |

```
Expo app ──Clerk JWT──> Expo API routes ──> Neon Postgres
    │                         │
    │                         ├──> TensorX (via OpenAI SDK, custom baseURL)
    │                         │
    │                         └──> S3: mint presigned PUT/GET URLs
    └──presigned URL──────────────> S3 bucket (direct upload/download)
```

**The app bundle never holds the TensorX key, the Neon connection string, or AWS
credentials.** Files move between device and S3 through short-lived presigned URLs
minted by the API.

### Decisions

- **D1 — Expo API Routes instead of a separate Hono service.** One repo, one deploy,
  same TypeScript types shared between client and server. If API routes prove
  limiting (long-running jobs, cron), move the server code to a small Hono app; the
  repository layer (D3) makes that a file move, not a rewrite.
- **D2 — Clerk owns identity.** No anonymous mode in v2. Sign-in required before any
  data is written. `users` row is created on first authenticated request, keyed by
  Clerk user id. Clerk webhooks (`user.deleted`) drive account deletion.
- **D3 — No RLS; the API is the trust boundary.** Every DB access goes through a
  repository class that takes `userId` as a required constructor argument. An
  unscoped query must be impossible to express.
- **D4 — Reminders are scheduled on-device first.** When a planned expense is saved,
  the app schedules two local notifications (T-24h, T-1h) with `expo-notifications`.
  Server-side push is a later fallback for multi-device; `planned_expenses` keeps
  `reminder_24h_sent_at` / `reminder_1h_sent_at` so either path is idempotent.
- **D5 — Nothing from a file import auto-commits.** Parsed rows land in
  `import_items` (staging). They become `expenses` only when the user validates. Low
  confidence rows start unticked.
- **D6 — Stats in SQL, prose from the model.** Recap figures come from queries. The
  AI writes the narrative over figures it cannot change.
- **D7 — Money is `bigint` minor units + ISO-4217 code.** XAF exponent 0. Never floats.
- **D8 — `occurred_on` drives all reporting.** `paid_on` is informational.
- **D9 — Client-generated UUIDs (v7)** on `expenses`, `planned_expenses`, `imports`,
  so retries are idempotent.
- **D10 — Soft deletes** (`deleted_at`) on all user data tables.
- **D11 — AI calls use the OpenAI SDK against TensorX.** `new OpenAI({ baseURL:
  'https://api.tensorx.ai/v1', apiKey: process.env.TENSORX_API_KEY })`. No
  TensorX-specific SDK, no Anthropic SDK. Structured output via `response_format`
  JSON schema or `tools` with `tool_choice`, whichever F3.3 confirms TensorX honours.
- **D12 — Proof files live in a private S3 bucket, referenced by key.** An expense
  can carry zero or more `attachments` (photo or PDF). Upload flow: app asks
  `POST /api/attachments/presign` → API returns a presigned PUT URL + the object key
  → app uploads directly to S3 → app calls `POST /api/attachments` to confirm and
  link. Reads use presigned GET URLs with a short TTL. Keys are
  `users/{userId}/{yyyy}/{mm}/{uuid}.{ext}` so a per-user purge is a prefix delete.
  Import uploads (E3) reuse the same bucket and flow.

---

## 3. Data model

Source of truth: `src/server/db/schema.ts`. Migrations in `src/server/db/migrations/`
(first one: `0000_curious_whiplash.sql`, 11 tables, 8 enums). Tables:

| Table | Purpose | Status |
|---|---|---|
| `users` | one row per Clerk user; currency, timezone, push token | done |
| `currencies` | reference data: code, exponent, symbol | done |
| `categories` | per-user, optional monthly budget, one-level `parent_id` | done |
| `expenses` | the ledger; `import_item_id` and `recurring_charge_id` audit links | done |
| `imports` | one row per uploaded xlsx/csv/pdf; `storage_key` into S3, status, model, tokens | done |
| `import_items` | staged rows awaiting validation; `review_state`, `confidence` | done |
| `planned_expenses` | scheduled future spend: title, amount, `scheduled_at` (timestamptz), place, reason, category, status `planned/done/skipped`, `completed_expense_id`, reminder sent timestamps, `recurring_charge_id` + `period_start` when materialised | done |
| `recurring_charges` | fixed monthly charges: name, amount, `day_of_month`, category, `active`, `starts_on`, `ends_on`, `reminder_time` | done |
| `recaps` | period `day/week/month`, `period_start`, `stats` jsonb, `narrative_md`, `is_stale` | done |
| `ai_usage` | per-user per-month per-operation call and token counters | done |
| `attachments` | proof files: `user_id`, `expense_id` (nullable until linked), `storage_key`, `mime_type`, `size_bytes`, `sha256`, `kind` (`photo/pdf`), `uploaded_at`, `deleted_at` | done |

Enums: `expense_source` (`manual, import, planned, recurring`), `import_status`,
`import_source_type` (`xlsx, csv, pdf_text, pdf_scan`), `review_state`,
`planned_status`, `recap_period`, `attachment_kind` (`photo, pdf`).

---

## 4. Repository layout

```
expense-app/
├── CLAUDE.md                          this file
├── README.md                          quick start
├── app.json                           Expo config: scheme, plugins, web.output "server"
├── package.json                       pnpm scripts: typecheck, lint, test, db:*
├── drizzle.config.ts                  Postgres; schema → src/server/db/migrations
├── eslint.config.js                   expo flat config + no client→server imports
├── vitest.config.mts
├── .env.example                       every variable, client and server
├── .github/workflows/ci.yml           install, typecheck, lint, test
├── app/                               expo-router
│   ├── _layout.tsx                    ClerkProvider + Stack
│   ├── index.tsx                      placeholder home (replaced in E1/E2)
│   └── api/                           Expo API Routes (server-only)
│       ├── health+api.ts              liveness, no server imports
│       └── me+api.ts                  auth smoke test
├── src/
│   ├── server/                        never imported by client code
│   │   ├── env.ts                     zod-validated server env
│   │   ├── db/schema.ts, client.ts, seed.ts, migrations/
│   │   ├── repositories/              base (userId-scoped), users, expenses, index
│   │   ├── auth/clerk.ts              withAuth() wrapper + json()
│   │   ├── ai/client.ts               OpenAI SDK → TensorX, MODELS, logUsage()
│   │   └── storage/s3.ts              presignPut/Get, headObject, deletePrefix
│   ├── ai/extraction-contract.ts      client-safe tool schema, prompt, classifyLine()
│   └── lib/                           api.ts (authed fetch), money.ts
├── docs/NEON_NOTES.md, S3_SETUP.md
└── assets/                            icons from the Expo template (replace later)
```

Planned, not yet created: `app/(auth)/`, `app/(tabs)/`, `app/import/`,
`src/features/`.

---

## 5. Conventions

1. Secrets live only in server env (`DATABASE_URL`, `DIRECT_URL`, `TENSORX_API_KEY`,
   `CLERK_SECRET_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`,
   `S3_REGION`). Client gets only `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and
   `EXPO_PUBLIC_API_URL`.
2. All DB access through repositories with mandatory `userId` (D3).
3. Money: `bigint` minor units + currency code. Resolve exponent from `currencies`
   before formatting (D7).
4. Dates: calendar dates as `date`, instants as `timestamptz`. Planned expenses use
   `timestamptz` because the reminder is a moment in time, interpreted in
   `users.timezone`.
5. Locale: `.` and thin space are thousands separators, `,` is decimal; numeric dates
   DD/MM; default currency XAF; default timezone Africa/Douala. Overridable per user.
6. Migrations: `drizzle-kit generate`, read the SQL, then `drizzle-kit migrate` against
   the **direct** Neon URL. Never edit a shipped migration.
7. AI model IDs live in one `MODELS` constant. TensorX model ids are verified against
   `GET /v1/models` before release.
8. Every AI call records model, tokens and latency to `ai_usage` and to the owning
   `imports` / `recaps` row.
9. Do not add a dependency without adding it to the table in section 2.
10. Files: max 10 MB per attachment, allowed MIME types `image/jpeg`, `image/png`,
    `image/heic`, `application/pdf`. Images are compressed on-device with
    `expo-image-manipulator` before upload. The API validates MIME and size on
    confirm, and S3 presigned PUTs are constrained by `ContentLength` and
    `ContentType`.
11. Never store or return a public S3 URL. Only object keys in the DB; presigned
    GET URLs with ≤15 min TTL at read time.

---

## 6. Feature Registry

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` planned · `[-]` dropped
Never delete a row; mark `[-]` with a reason. Name the owning file(s) when done.

### E0 — Foundation
- [x] F0.1 `package.json`, `app.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `.npmrc`
- [x] F0.2 Initialise git, first commit (remote to be added by owner)
- [~] F0.3 Expo API Routes enabled (`web.output: "server"` in `app.json`) — **EAS Hosting project still to create** (`eas init`, needs account login)
- [x] F0.4 Server code in `src/server/`; `timestamptz` bug fixed via `timestamp(..., { withTimezone: true })` helper
- [x] F0.5 Schema v2 — `src/server/db/schema.ts` (11 tables, 8 enums, all relations)
- [~] F0.6 First migration generated and reviewed (`0000_curious_whiplash.sql`, CREATE only) — **not yet applied**: needs a Neon project and `DIRECT_URL`; run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` then `pnpm db:migrate`
- [~] F0.7 Seed script `src/server/db/seed.ts` (XAF, XOF, EUR, USD, GBP, NGN) — run `pnpm db:seed` after F0.6
- [x] F0.8 Repository layer — `src/server/repositories/` (`UserScopedRepository`, `UsersRepository`, `ExpensesRepository`, `createRepositories()`)
- [x] F0.9 `pnpm typecheck` / `lint` / `test`, ESLint client→server import ban, GitHub Actions CI
- [x] F0.10 Tests — `src/ai/extraction-contract.test.ts` (12), `src/lib/money.test.ts` (6)
- [x] F0.11 README rewritten; SQLite draft, `api/`, `SETUP.md`, babel/metro configs deleted; Neon notes moved to `docs/`
- [~] F0.12 S3 bucket — runbook in `docs/S3_SETUP.md` (bucket, CORS, IAM policy); **bucket itself still to create** in AWS
- [x] F0.13 `src/server/storage/s3.ts`: `buildObjectKey`, `presignPut`, `presignGet`, `headObject`, `deleteObject`, `deletePrefix`, MIME/size constants
- [x] F0.14 `src/server/ai/client.ts`: OpenAI SDK → TensorX, `MODELS` (env-overridable), `logUsage()`, `listModels()`

### E1 — Auth (Clerk)
- [x] F1.1 `@clerk/clerk-expo` provider + secure token cache — `app/_layout.tsx`
- [ ] F1.2 Sign-in / sign-up screens (email + OTP, Google)
- [x] F1.3 API middleware `withAuth()` — `src/server/auth/clerk.ts`; smoke route `app/api/me+api.ts`
- [ ] F1.4 Settings: currency, timezone, sign out
- [ ] F1.5 Clerk `user.deleted` webhook → cascade delete user data
- [ ] F1.6 In-app "delete my account" (store requirement)

### E2 — Manual expenses
- [ ] F2.1 `POST /api/expenses` idempotent on client UUID
- [ ] F2.2 `GET /api/expenses` paginated, filter by date range / category / source
- [ ] F2.3 `PATCH` / soft `DELETE /api/expenses/:id`
- [ ] F2.4 Categories CRUD with per-user uniqueness and optional budget; default category set seeded on first login
- [ ] F2.5 Add-expense form: amount (locale-aware input), date, description, payee, category, notes, `paid_on`
- [ ] F2.6 Expense list grouped by day/month, search, swipe to delete
- [ ] F2.7 Expense detail / edit; link to `import_items` source row when present
- [ ] F2.8 Editing a past expense marks affected `recaps.is_stale`

### E2b — Proof attachments (S3)
- [ ] F2b.1 `POST /api/attachments/presign` → `{ key, uploadUrl, expiresAt }`; validates MIME + size
- [ ] F2b.2 `POST /api/attachments` confirm: HEAD the object, record `attachments` row, link to `expense_id`
- [ ] F2b.3 `GET /api/attachments/:id/url` → presigned GET, ≤15 min
- [ ] F2b.4 `DELETE /api/attachments/:id` soft delete + S3 object delete
- [ ] F2b.5 Add-expense and edit forms: attach from camera (`expo-camera` / `expo-image-picker`) or file picker; HEIC/JPEG compressed on-device before upload
- [ ] F2b.6 Expense detail: thumbnail strip, full-screen viewer for images, PDF viewer
- [ ] F2b.7 Upload progress + retry; offline-safe (upload resumes when the app returns)
- [ ] F2b.8 Planned expense "mark as done" accepts an attachment (receipt) in the same step
- [ ] F2b.9 Account deletion purges `users/{userId}/` prefix in S3 (ties to F1.5)
- [ ] F2b.10 Expense list filter: "with proof" / "without proof"

### E3 — File ingestion (Excel / CSV / PDF) with AI
- [x] F3.1 Review-gating logic `classifyLine()` and `reconcileAgainstTotal()` — `src/ai/extraction-contract.ts` (port from v1, still valid)
- [-] F3.2 TensorX client — moved to F0.14
- [ ] F3.3 **Verify** TensorX capabilities: JSON mode / tool calling, image input, max file size; record findings in section 2 table
- [ ] F3.4 File picker (`expo-document-picker`) for `.xlsx .xls .csv .pdf`, upload to S3 via presigned PUT (D12), then `POST /api/imports` with the `storage_key`
- [ ] F3.5 Excel/CSV path: parse with SheetJS server-side → AI maps columns to `{amount, date, description, payee, category}` and normalises locale formats → `import_items`
- [ ] F3.6 Text-PDF path: `pdf-parse` → AI line extraction → `import_items`
- [ ] F3.7 Scanned-PDF path: page images → multimodal TensorX model with the v1 extraction prompt → `import_items`
- [ ] F3.8 `GET /api/imports/:id` status polling
- [ ] F3.9 Review screen: one row per staged item, severity from `classifyLine()`, inline edit, bulk tick/untick, duplicate detection against existing expenses
- [ ] F3.10 Total reconciliation banner when the document states a total
- [ ] F3.11 `POST /api/imports/:id/commit` promotes accepted items to `expenses` atomically (`db.batch`), source `import`
- [ ] F3.12 Import history screen; re-open a committed import read-only
- [ ] F3.13 Retry policy, attempt cap, failure reasons shown to the user

### E4 — Recaps: daily, weekly, monthly
- [ ] F4.1 SQL rollups: total, count, by category, by payee, vs budget, vs previous period — for day / week / month
- [ ] F4.2 `GET /api/recaps?period=&start=` computes on demand and caches in `recaps`
- [ ] F4.3 AI narrative (TensorX) over the stats only; stored in `narrative_md`
- [ ] F4.4 Recap screen: period switcher, headline figures, category breakdown chart, narrative
- [ ] F4.5 Home dashboard: today, this week, this month at a glance
- [ ] F4.6 Weekly and monthly recap push notification (opt-in)
- [ ] F4.7 Stale recap regeneration when underlying expenses change

### E5 — Planned expenses and reminders
- [ ] F5.1 `planned_expenses` CRUD API
- [ ] F5.2 Create form: title, amount, date + time, place, reason/notes, category, optional recurrence link
- [ ] F5.3 Local reminders via `expo-notifications`: T-24h and T-1h; rescheduled on edit, cancelled on delete/done
- [ ] F5.4 Notification permission request flow with rationale screen
- [ ] F5.5 Plan screen: upcoming list grouped by day, overdue section
- [ ] F5.6 "Mark as done" → creates the real `expense` (source `planned`), links `completed_expense_id`, status `done`; "Skip" sets `skipped`
- [ ] F5.7 Monthly and yearly planning view: calendar / list of planned items with totals per month
- [ ] F5.8 Tapping a reminder opens the planned item with a one-tap "Mark as paid"
- [ ] F5.9 Server-side push fallback for multi-device (later)

### E6 — Fixed monthly charges
- [ ] F6.1 `recurring_charges` CRUD API
- [ ] F6.2 Form: name, amount, day of month, category, start / end, active toggle
- [ ] F6.3 Materialisation: at month start (or on first app open in the month) create `planned_expenses` rows for each active charge, so reminders and "mark done" reuse E5
- [ ] F6.4 Fixed-charges screen with monthly total and paid / unpaid status for the current month
- [ ] F6.5 Recaps include "fixed vs variable" split

### E7 — Store compliance and ops
- [ ] F7.1 Privacy policy; disclose that imported files are processed by a third-party AI provider (TensorX, EU-hosted) and that attachments are stored in S3 (name the region)
- [ ] F7.2 Permission strings: notifications, file access
- [ ] F7.3 EAS build profiles (development, preview, production) and EAS Hosting deploy
- [ ] F7.4 Neon region close to users; API routes deployed in the same region
- [ ] F7.5 Error reporting (Sentry) for app and API routes
- [ ] F7.6 Quota per user per month on AI operations, backed by `ai_usage`

### E8 — Later / exploratory (not committed)
- [ ] F8.1 Camera capture of handwritten lists (v1 extraction prompt is ready for it)
- [ ] F8.2 SMS auto-capture of mobile-money confirmations (Android only)
- [ ] F8.3 Offline outbox with expo-sqlite
- [ ] F8.4 Shared / household ledgers
- [ ] F8.5 Export to Excel / PDF

---

## 7. Working agreements for Claude Code

- Read this file before any change. Read `docs/NEON_NOTES.md` before DB work and
  `docs/S3_SETUP.md` before storage work.
- Build in registry order within an epic unless a row says otherwise. E0 and E1 gate
  everything else.
- Every new query goes through a repository (D3). If the repository does not exist,
  create it first.
- Client code never imports from `src/server/`. ESLint enforces it
  (`no-restricted-imports` in `eslint.config.js`); do not disable the rule, add an API route.
- Model IDs only in `MODELS`. Verify TensorX ids via `GET /v1/models`.
- When a feature ships: flip checkbox, name files, Changelog line, same commit.

---

## 8. Changelog

- 2026-10-04 — **E0 foundation built.** Expo SDK 57 project with pnpm; schema v2
  and first migration (generated, reviewed, not applied); zod env; repositories;
  Clerk `withAuth()`; OpenAI→TensorX client; S3 presign module; ESLint
  client/server boundary; vitest (18 tests); CI workflow; README and docs
  rewritten; SQLite draft removed; first git commit. Still manual: create Neon
  project + run migrate/seed (F0.6/F0.7), EAS Hosting project (F0.3), S3 bucket
  (F0.12).
- 2026-10-04 — AI client fixed to the OpenAI SDK with TensorX `baseURL` (D11), as
  on the dorti project. Added S3 proof attachments: `attachments` table, presigned
  upload/download flow (D12), epic E2b, foundation items F0.12–F0.14, file
  conventions 10–11.
- 2026-10-04 — Scope v2. Dropped Firebase, Hono, Anthropic direct, camera-first flow.
  Adopted Clerk, Expo API Routes, TensorX. Feature set: manual entry, Excel/PDF
  ingestion with validation, daily/weekly/monthly recaps, planned expenses with
  T-24h / T-1h reminders, monthly/yearly planning with mark-done, fixed monthly
  charges. Registry E0–E8 rewritten.
- 2026-10-04 — Initial audit of v1 scaffold (see section 9).

---

## 9. What carried over from v1 (audit summary)

Code that existed before the v2 redesign and its fate:

| File | Fate |
|---|---|
| `api/src/db/schema.pg.ts` | Done → `src/server/db/schema.ts` (renamed, extended, A1–A6 fixed). |
| `api/src/db/client.ts` | Done → `src/server/db/client.ts`. |
| `api/drizzle.config.ts` | Done → root `drizzle.config.ts`. |
| `api/NEON_NOTES.md` | Done → `docs/NEON_NOTES.md`. |
| `src/ai/extraction-contract.ts` | Done: tool converted to OpenAI function shape, Anthropic `MODELS` removed (ids now in `src/server/ai/client.ts`), wording fixed. Prompt and gating unchanged. |
| `src/db/schema.ts`, `src/db/client.ts`, root `drizzle.config.ts`, `babel.config.js` inline-import, `metro.config.js` sql ext, `SETUP.md` | Deleted (F0.11). Recoverable from `../expense-app.zip` if F8.3 is taken up. |
| `app/_layout.tsx` | Done: ClerkProvider + Stack. |
| `README.md` | Done (F0.11). |

Defects found in carried-over code (all fixed in `src/server/db/schema.ts`):

| # | Where | Problem |
|---|---|---|
| A1 | `api/src/db/schema.pg.ts` | Imports `timestamptz` from `drizzle-orm/pg-core`; no such export. Use `timestamp(name, { withTimezone: true })`. Will not compile. |
| A2 | `expenses.extractionItemId` | No FK. Add FK to `import_items.id` on rename. |
| A3 | `extractions.sourceType` | Free text; make it the `import_source_type` enum. |
| A4 | `categories.parentId` | No self FK, no depth limit. |
| A5 | `aiUsage` | No primary key. |
| A6 | relations | Missing for categories, items, reports, usage. |
