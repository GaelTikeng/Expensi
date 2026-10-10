# CLAUDE.md — xpens-ia

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

**Name: xpens-ia.** Identifiers: Expo slug and package name `xpens-ia`, deep-link
scheme `xpensia`, iOS bundle id and Android package `ltd.nyota.xpensia` (Android
forbids hyphens). The repo folder is still `expense-app`; the GitHub repo is
`GaelTikeng/Expensi`.

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
| Auth | **Clerk** (`@clerk/expo` 4.x, Core 3) | web: Clerk `<SignIn />`; dev/store builds: native `AuthView`; Expo Go: our `CustomSignIn` on `@clerk/expo/legacy` hooks. Server verifies the session JWT; `users.clerk_user_id` is the tenant key |
| Database | **Neon Postgres** (PostgreSQL 18, `eu-central-1`, project live) | `@neondatabase/serverless`, neon-http driver; `DIRECT_URL` for migrations |
| ORM | **Drizzle** (`pg-core`), server-side only | migrations with drizzle-kit |
| AI | **OpenAI SDK** (`openai` npm) with `baseURL: https://api.tensorx.ai/v1` and `TENSORX_API_KEY` | verified 2026-10-04: tool calling ✓, json_schema ✓, image input ✓. Models reason first and **reasoning tokens count against `max_tokens`**: budget generously and treat `finish_reason: length` as failure |
| File storage | **S3** (or S3-compatible) via `@aws-sdk/client-s3` + presigned URLs | proof attachments (photo, PDF) and import uploads; private bucket, never public URLs |
| Push / reminders | `expo-notifications` local scheduling + Expo Push for server-triggered | see D4 |
| File parsing | SheetJS (`xlsx`) for Excel/CSV, `pdf-parse` for text PDFs, multimodal TensorX model for scanned PDFs | |
| Observability | `@sentry/react-native` (client, DSN-gated); server routes log via `console` | server Sentry pending |
| UI / styling | **NativeWind 4.2** (Tailwind CSS **v3**) + **React Native Reusables** components copied into `src/components/ui/` (`@rn-primitives/*`, `class-variance-authority`, `tailwind-merge` v2, `lucide-react-native` + `react-native-svg`); `@react-native-community/datetimepicker`; `react-native-gesture-handler` + `react-native-reanimated` (swipe rows) | see D13. Category glyphs stay on `@expo/vector-icons` Ionicons (stored in DB) |
| Action sheets | `src/components/action-sheet.tsx` (`ActionSheetHost` at the root, `useActionSheets().confirm/show`): iOS uses the system sheet via `@expo/react-native-action-sheet`; Android and web draw our own sheet over an `expo-blur` backdrop (NativeWindUI Action Sheet pattern) | every in-place choice (delete, skip, add proof, commit) is a sheet; plain messages stay `Alert` |
| Client cache | **TanStack Query 5** (`@tanstack/react-query`) | `src/lib/query.ts`: `queryClient`, `keys`, `invalidate`, `useRefetchOnFocus`; see D15 |
| Native builds | **EAS Build**, project `@gaeltikeng/xpens-ia`; `expo-dev-client`; pnpm pinned to **9.15.2** in every `eas.json` profile | EAS defaults to pnpm 11, which ignores `package.json#pnpm`; see `docs/DEPLOY.md` |

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
  the app schedules two local notifications (T-24h, T-0) with `expo-notifications`.
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
- **D13 — Styling is NativeWind + React Native Reusables; we own the components.**
  Components come from the Reusables registry via
  `npx @react-native-reusables/cli@latest add <name>` (NativeWind variant,
  `components.json` aliases → `src/components/ui`) and are then ours to edit.
  Colours are CSS variables in `global.css`, mirrored as literals in
  `src/lib/theme.ts` for props that need raw values (ActivityIndicator, icons,
  navigation chrome) through `useThemeColors()`; keep the two in sync. No new
  `StyleSheet.create` in migrated code. Shared layout helpers:
  `src/components/form-field.tsx`, `src/components/group.tsx`. The app follows
  the system colour scheme (F9.5). NativeWindUI (nativewindui.com) patterns are
  adopted piecemeal where they fit on top of this base (first: the Action
  Sheet); its full template (own theme files, `Text`, SF-symbol icons, dev
  client only) is not installed.
- **D14 — Supported currencies are a constant, not a table.** `src/lib/currencies.ts`
  (`CURRENCIES`, `CURRENCY_CODES`, `currencyInfo()`) is shared by pickers, zod
  schemas and the API. The `currencies` table and the FKs to it were dropped in
  migration `0001_strong_nova.sql`; adding a currency is a one-line code change.
- **D15 — One client cache: TanStack Query.** Every read goes through `useQuery` /
  `useInfiniteQuery` with keys from `src/lib/query.ts#keys`; every write calls the
  matching `invalidate.*` helper. Cached data renders instantly, refreshes in the
  background (`useRefetchOnFocus` for tab screens, `focusManager` for app
  foreground), and skeletons show only on a cold cache. Profile and categories
  are prefetched after sign-in and kept 10 min; lists 60 s. Detail screens open
  with `placeholderData` taken from the list that was tapped. The cache is
  cleared on sign-out.

---

## 3. Data model

Source of truth: `src/server/db/schema.ts`. Migrations in `src/server/db/migrations/`
(`0000_curious_whiplash.sql`: 11 tables, 8 enums; `0001_strong_nova.sql`: drops
`currencies`, D14). Tables:

| Table | Purpose | Status |
|---|---|---|
| `users` | one row per Clerk user; currency, timezone, push token | done |
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
│   ├── _layout.tsx                    ClerkProvider + Stack.Protected route guards
│   ├── (auth)/sign-in.tsx             email-code sign-in-or-up + Google SSO
│   ├── (tabs)/                        home, expenses, plan, recaps, settings
│   ├── expense/new.tsx, [id].tsx      create modal, detail/edit
│   ├── import/index.tsx, [id].tsx     history + upload, review
│   ├── planned/new, [id], month       plan create / detail / month list
│   ├── recurring/new, [id]            fixed charge create / edit
│   └── api/                           Expo API Routes (server-only)
│       ├── health+api.ts              liveness, no server imports
│       ├── me+api.ts                  GET profile, PATCH prefs, DELETE account
│       └── webhooks/clerk+api.ts      Clerk user.* events (verifyWebhook)
├── src/
│   ├── server/                        never imported by client code
│   │   ├── env.ts                     zod-validated server env
│   │   ├── db/schema.ts, client.ts, migrations/
│   │   ├── repositories/              base, users, expenses, categories, attachments, imports, planned, recurring, recaps
│   │   ├── services/account.ts        deleteAccountData(): S3 purge + cascade delete
│   │   ├── services/imports/          parse (SheetJS, pdf-parse), extract (model call), process, commit, dto
│   │   ├── services/recaps/           stats (SQL), narrative (model), index (cache)
│   │   ├── services/planned/dto.ts    planned + recurring DTOs
│   │   ├── services/maintenance.ts    sweepStaleUploads() (cross-user, cron only)
│   │   ├── ai/quota.ts                monthly AI limits (429)
│   │   ├── auth/clerk.ts              withAuth() wrapper, json(), clerk client
│   │   ├── ai/client.ts               OpenAI SDK → TensorX, MODELS, logUsage()
│   │   └── storage/s3.ts              presignPut/Get, headObject, deletePrefix
│   ├── ai/extraction-contract.ts      client-safe tool schema, prompt, classifyLine()
│   ├── features/
│   │   ├── attachments/               pick, upload (stage+presign+PUT+confirm), queue, tiles, viewer
│   │   ├── expenses/                  api, hooks, ExpenseForm, AmountInput, DateField, ExpenseRow
│   │   ├── imports/                   api, upload, review-utils, ImportItemRow, ItemEditModal
│   │   ├── recaps/                    api, useRecap, charts (View-based)
│   │   ├── planned/                   api, usePlanned, reminders, PlannedForm, RecurringForm, CompleteSheet, PlanningView, FixedChargesView
│   │   ├── notifications/             permissions, schedule (recaps + planned), setup hook, prefs toggles
│   │   ├── auth/                      useEmailCodeAuth, useGoogleAuth, useWarmUpBrowser, errors
│   │   └── settings/                  useMe (profile + currencies), OptionPicker
│   └── lib/                           api, query (cache), currencies, money, dates (+periods), uuid, prefs, timezones, schemas/
├── eas.json                           build profiles
├── scripts/tensorx-check.mjs          F3.3 capability probe
├── scripts/e2e-api.mjs                end-to-end API test incl. S3 uploads (pnpm test:e2e, E2E_BASE_URL)
├── scripts/db-init.mjs                one-time pgcrypto setup
├── docs/                              NEON_NOTES, S3_SETUP, DEPLOY, PRIVACY_POLICY
└── assets/                            icons from the Expo template (replace later)
```

All v2 screens exist; see §6 for what each still lacks.

---

## 5. Conventions

1. Secrets live only in server env (`DATABASE_URL`, `DIRECT_URL`, `TENSORX_API_KEY`,
   `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `AWS_*`, `S3_*`, `AI_QUOTA_*`,
   `MAINTENANCE_SECRET`). Client gets only `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SENTRY_DSN`.
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
- [x] F0.6 First migration applied to Neon (PostgreSQL 18, `eu-central-1`) on 2026-10-04: 11 tables, 8 enums. Prep script `scripts/db-init.mjs` (pgcrypto) then `pnpm db:migrate` against `DIRECT_URL`
- [-] F0.7 Currencies seeded via `pnpm db:seed` — replaced by the constant in `src/lib/currencies.ts` (D14, 2026-10-10); table dropped in migration 0001
- [x] F0.8 Repository layer — `src/server/repositories/` (`UserScopedRepository`, `UsersRepository`, `ExpensesRepository`, `createRepositories()`)
- [x] F0.9 `pnpm typecheck` / `lint` / `test`, ESLint client→server import ban, GitHub Actions CI
- [x] F0.10 Tests — `src/ai/extraction-contract.test.ts` (12), `src/lib/money.test.ts` (6)
- [x] F0.11 README rewritten; SQLite draft, `api/`, `SETUP.md`, babel/metro configs deleted; Neon notes moved to `docs/`
- [x] F0.12 S3 bucket `xpens-ia-files` (general purpose, `eu-central-1`, public access blocked, SSE-S3) created 2026-10-10 with the CORS rule and the `xpens-ia-api` IAM user scoped to `users/*` (`docs/S3_SETUP.md`). Verified by `pnpm test:e2e`: presign → PUT → confirm → view → delete, and the account purge
- [x] F0.13 `src/server/storage/s3.ts`: `buildObjectKey`, `presignPut`, `presignGet`, `headObject`, `deleteObject`, `deletePrefix`, MIME/size constants
- [x] F0.14 `src/server/ai/client.ts`: OpenAI SDK → TensorX, `MODELS` (env-overridable), `logUsage()`, `listModels()`

### E1 — Auth (Clerk)
- [x] F1.1 Clerk provider + secure token cache — `app/_layout.tsx`. Migrated from `@clerk/clerk-expo` to `@clerk/expo` 4.x on 2026-10-04
- [x] F1.2 Sign-in-or-up — `app/(auth)/sign-in.tsx` → `src/features/auth/ClerkAuthScreen{,.web}.tsx`: Clerk `<SignIn withSignUp />` on web, native `AuthView` in dev/store builds, `CustomSignIn` (email code + Google) in Expo Go. **Open issue:** the Clerk instance requires a password at sign-up but only allows email-code sign-in, so `CustomSignIn` cannot finish a new sign-up; turn the password requirement off in the Clerk dashboard (or collect a password there). Google redirect for native: `xpensia://sso-callback`
- [x] F1.3 API middleware `withAuth()` — `src/server/auth/clerk.ts`; smoke route `app/api/me+api.ts`
- [x] F1.4 Settings: currency, timezone (curated list `src/lib/timezones.ts`), sign out — `app/(tabs)/settings.tsx`, `src/features/settings/*`, `PATCH /api/me` (`GET /api/currencies` removed with D14)
- [x] F1.5 Clerk webhook (`user.created/updated/deleted`) — `app/api/webhooks/clerk+api.ts`, `src/server/services/account.ts`. Needs `CLERK_WEBHOOK_SIGNING_SECRET` and the endpoint registered in Clerk
- [x] F1.6 In-app delete account — `DELETE /api/me` purges S3 prefix + DB rows, then deletes the Clerk user

### E2 — Manual expenses
- [x] F2.1 `POST /api/expenses` idempotent on client UUID v7 (`src/lib/uuid.ts`) — 201 on create, 200 on replay
- [x] F2.2 `GET /api/expenses` offset-paginated (`nextOffset`), filters from/to/categoryId/source, `q` search over description+payee
- [x] F2.3 `GET`/`PATCH`/`DELETE /api/expenses/[id]` — `app/api/expenses/[id]+api.ts`
- [x] F2.4 Categories CRUD (`app/api/categories*`), one-level nesting enforced, soft-delete detaches expenses, 14 defaults seeded on first authenticated request (`src/server/data/default-categories.ts`)
- [x] F2.5 Add-expense form — `src/features/expenses/ExpenseForm.tsx` (AmountInput, DateField with native picker, currency/category pickers, paid_on toggle, estimated switch); `app/expense/new.tsx` modal
- [x] F2.6 Expenses tab — `app/(tabs)/expenses.tsx`: month sections with per-currency totals, debounced search, swipe-to-delete (ReanimatedSwipeable), infinite scroll, FAB
- [x] F2.7 Detail/edit/delete — `app/expense/[id].tsx`; shows an "imported" banner when `importItemId` is set (deep link to the import lands with E3)
- [x] F2.8 `RecapsRepository.markStaleFor()` called on create/update/delete for day, week and month recaps

### E2b — Proof attachments (S3)
- [x] F2b.1 `POST /api/attachments/presign` — pending row + presigned PUT; idempotent on client id, 409 after confirm
- [x] F2b.2 `POST /api/attachments` confirm — HEADs the object, rejects size/type mismatch (and deletes the object), sets `uploaded_at`, links `expense_id`
- [x] F2b.3 `GET /api/attachments/[id]/url` (15 min) and `GET /api/attachments?expenseId=` returning items with view URLs
- [x] F2b.4 `DELETE /api/attachments/[id]` soft delete + best-effort object delete
- [x] F2b.5 Pickers (camera, library, PDF) — `src/features/attachments/pick.ts`; images resized to 1600px JPEG 0.8 and staged in app storage — `upload.ts`; `LocalFilesPicker` in create, `AttachmentsSection` in detail
- [x] F2b.6 Thumbnail strip (`FileTile`), full-screen image modal, PDFs open in the in-app browser — `AttachmentViewer.tsx`
- [x] F2b.7 Progress callbacks via legacy `createUploadTask`, 3 PUT retries with backoff, persisted retry queue (`queue.ts`) flushed on launch/foreground (`useUploadQueueFlush`). Server-side orphan sweep for never-confirmed rows still TODO (uses `listStalePending`)
- [x] F2b.8 `CompleteSheet` includes `LocalFilesPicker`; receipts upload against the new expense after completion (`completeFlow.ts`), parked offline if needed
- [x] F2b.9 Account deletion purges `users/{userId}/` prefix in S3 — `src/server/services/account.ts` (done with E1)
- [x] F2b.10 Expenses tab chips All / With proof / Without proof (`hasAttachment` query) and paperclip on rows (`attachmentCount`)

### E3 — File ingestion (Excel / CSV / PDF) with AI
- [x] F3.1 Review-gating logic `classifyLine()` and `reconcileAgainstTotal()` — `src/ai/extraction-contract.ts` (port from v1, still valid)
- [-] F3.2 TensorX client — moved to F0.14
- [x] F3.3 TensorX verified 2026-10-04 with `scripts/tensorx-check.mjs`: 15 models; `z-ai/glm-5.3-flash` (extract) and `z-ai/glm-5.3` (narrative) listed; forced tool calling ✓, `response_format: json_schema` ✓, **image input ✓** (`glm-5.3-flash` named the red test image). An earlier "no vision" result was a false negative: the 32-token budget was spent on reasoning. Probe budgets are now 1024
- [x] F3.4 `app/import/index.tsx` + `src/features/imports/upload.ts`: picker → `POST /api/imports/presign` → PUT → `POST /api/imports` (idempotent on client id)
- [x] F3.5 Excel/CSV: SheetJS picks the largest sheet, emits TSV (≤500 rows) → model with `TABULAR_PROMPT_ADDENDUM` + user's category names → `import_items` — `src/server/services/imports/{parse,extract,process}.ts`
- [x] F3.6 Text PDF: `pdf-parse` → same extraction call. Note: `pdf-parse` is Node-only; if EAS Hosting's runtime rejects it, move the import pipeline to a Node service (D1 escape hatch)
- [~] F3.7 Scanned PDF: detected when extracted text < 40 chars/page; sent as an OpenAI `file` content part (base64). Image input is confirmed (F3.3) but **whether TensorX accepts PDF `file` parts is still untested**; if it does not, rasterise pages to images server-side. Needs a real scanned PDF to verify
- [x] F3.8 `GET /api/imports/[id]` (status, items, duplicate flags, reconciliation) and `POST /api/imports/[id]/process` (synchronous pipeline, idempotent, 409 while in flight)
- [x] F3.9 `app/import/[id].tsx`: rows via `reviewItems()` (classifyLine + duplicate demotion), tick/untick/bulk, `ItemEditModal` → `PATCH /api/imports/[id]/items/[itemId]`; duplicates = same amount + same day in the ledger (computed in `dto.ts`)
- [x] F3.10 Reconciliation banner (matches / off by X) from `reconcileAgainstTotal()` server-side
- [x] F3.11 `POST /api/imports/[id]/commit` — `services/imports/commit.ts` uses `db.batch`; validates kind/amount/date; marks recaps stale
- [x] F3.12 History list in `app/import/index.tsx`; committed imports open read-only showing accepted rows
- [x] F3.13 3 attempts, stale `processing` rows retryable after 2 min, friendly failure reasons, retry button with remaining count
- [x] F3.14 Duplicate resolution (2026-10-10): the duplicate warning on a line opens `DuplicateSheet` (side-by-side fields, differences in bold, link to the saved expense). Before commit: skip the line / import and delete the saved expense / import anyway. After commit: keep this one or the saved one (the other is deleted). `possibleDuplicateOf` carries the full candidate; lines from the same import never match their own expense; `expenseId` on committed lines

### E4 — Recaps: daily, weekly, monthly
- [x] F4.1 `src/server/services/recaps/stats.ts`: total/count/estimated/with-proof, vs previous period, by category (+budget % for months), top payees, by day, largest 3, fixed vs variable, other currencies
- [x] F4.2 `GET /api/recaps?period=&start=&narrative=` — `services/recaps/index.ts` serves the cache when fresh, recomputes when missing/stale, upserts
- [x] F4.3 `services/recaps/narrative.ts` — narrative model over trimmed stats JSON, 3–5 sentences, stored in `narrative_md`; failure never fails the recap
- [x] F4.4 Recaps tab `app/(tabs)/recaps.tsx`: Day/Week/Month segment, prev/next, headline + delta, by-day columns, narrative card (on demand since 2026-10-10: a **Summarise** button triggers the model; a stored summary shows at once), category bars with budget %, fixed vs variable, top payees, largest — `src/features/recaps/*`
- [x] F4.5 Home `app/(tabs)/index.tsx` via `GET /api/recaps/overview`: three tiles with deltas, biggest category, quick actions
- [x] F4.6 Opt-in **local** reminders (Monday / 1st at 09:00) scheduled on-device — `src/features/notifications/*`, toggles in Settings, prefs in `src/lib/prefs.ts`. Android monthly re-armed on app open. Server push not needed for this
- [x] F4.7 `is_stale` rows recomputed on next read; stale narrative cleared when stats change

### E5 — Planned expenses and reminders
- [x] F5.1 `GET/POST /api/planned`, `GET/PATCH/DELETE /api/planned/[id]`, `POST /api/planned/[id]/complete`, `GET /api/planned/summary` — `PlannedRepository`
- [x] F5.2 `PlannedForm` (what, amount, currency, when + time, where, to whom, why, category, notes) — `app/planned/new.tsx`
- [x] F5.3 Local T-24h / T-0 reminders (T-1h dropped 2026-10-10 at the owner's request) — `src/features/planned/reminders.ts` + `notifications/schedule.ts`; armed on create/edit/unskip, cancelled on done/skip/delete; past offsets skipped; `syncReminders()` on Plan load (capped at 30 upcoming plans for the iOS 64-notification limit). The plan form says when reminders cannot fire (Expo Go on Android, web)
- [x] F5.4 Permission flow with rationale alert, Settings deep link when denied, Android channel — `src/features/notifications/permissions.ts` (built with E4)
- [x] F5.5 Plan tab `app/(tabs)/plan.tsx` — Upcoming with Overdue section, ✓ quick-complete, FAB
- [x] F5.6 `CompleteSheet` (actual amount, paid date, receipt) → `complete` route runs one `db.batch`: insert expense (`source` planned/recurring), flip status, link attachments; Skip / put back via PATCH status
- [x] F5.7 Planning view (`PlanningView`): year switcher, 12 months with planned/done/skipped totals → `app/planned/month.tsx` list
- [x] F5.8 Notification payload `url` → `/planned/[id]`; detail screen leads with a green **Mark as paid** button
- [ ] F5.9 Server-side push fallback for multi-device (later)

### E6 — Fixed monthly charges
- [x] F6.1 `GET/POST /api/recurring`, `PATCH/DELETE /api/recurring/[id]`, `POST /api/recurring/materialize` — `RecurringRepository`
- [x] F6.2 `RecurringForm` (name, amount, currency, day of month, reminder time, start/end, category, payee, notes, active) — `app/recurring/new.tsx`, `[id].tsx`
- [x] F6.3 `materialize()` creates this + next month's plans per active charge (`zonedTimeToUtc` in the user's timezone, day clamped to month length), idempotent via unique (charge, period); called on Plan load and after charge create/edit; deleting a charge removes its unpaid plans
- [x] F6.4 `FixedChargesView`: monthly total, paid count, per-charge due/paid/skipped badge; hold to open this month's plan
- [x] F6.5 Recaps show fixed vs variable (expenses linked to a `recurring_charge_id`) — done with E4; populated once E6 lands

### E7 — Store compliance and ops
- [~] F7.1 Privacy policy draft `docs/PRIVACY_POLICY.md` (AI processing, S3 region, deletion) + in-app summary `app/privacy.tsx` linked from Settings. **Still to do: legal review and hosting at a public URL for the store listings**
- [x] F7.2 Permission strings in `app.json`: camera + photo library (`infoPlist`, plugin props), Android `CAMERA`, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`; notifications use the runtime rationale flow (F5.4); document picker needs none
- [~] F7.3 EAS linked (`@gaeltikeng/xpens-ia`, owner in `app.json`); Android development build working (pnpm pinned to 9.15.2, `expo-dev-client`); runbook `docs/DEPLOY.md`. **Still to do:** iOS dev build, API routes deploy (`eas deploy`), set `EXPO_PUBLIC_API_URL` for preview/production
- [~] F7.4 Neon project is in `eu-central-1` ✓. **Choose the same region when deploying the API routes** (`docs/DEPLOY.md` §1)
- [~] F7.5 Client: `@sentry/react-native` + Expo plugin, `src/lib/sentry.ts` (`initSentry`, `setSentryUser`, `reportError`), enabled only when `EXPO_PUBLIC_SENTRY_DSN` is set; user id attached after sign-in. **API routes still log to console only** (`withAuth` catch-all); add a server DSN later
- [x] F7.7 Maintenance: `POST /api/maintenance/sweep` (header `x-maintenance-secret`, enabled by `MAINTENANCE_SECRET`) deletes never-confirmed attachments > 24 h — `src/server/services/maintenance.ts`; cron recipe in `docs/DEPLOY.md` §3. Closes the F2b.7 orphan-sweep note
- [x] F7.6 `src/server/ai/quota.ts` (`assertQuota` → 429, `quotaStatus`), limits via `AI_QUOTA_EXTRACT_PER_MONTH` / `AI_QUOTA_NARRATIVE_PER_MONTH`; enforced before import processing, narrative skipped when exhausted; `GET /api/usage` shown in Settings

### E8 — Later / exploratory (not committed)
- [ ] F8.1 Camera capture of handwritten lists (v1 extraction prompt is ready for it)
- [ ] F8.2 SMS auto-capture of mobile-money confirmations (Android only)
- [ ] F8.3 Offline outbox with expo-sqlite
- [ ] F8.4 Shared / household ledgers
- [-] F8.5 Export to Excel / PDF — promoted to E10 (2026-10-10)

### E9 — UI kit: NativeWind + React Native Reusables (D13)
- [x] F9.1 Setup: `babel.config.js`, `metro.config.js` (`inlineRem: 16`), `tailwind.config.js`, `global.css` (light + dark palettes from the existing look), `nativewind-env.d.ts`, `components.json`, `src/lib/utils.ts` (`cn`), `src/lib/theme.ts` (`THEME`, `NAV_THEME`); root layout loads the CSS, wraps `ThemeProvider` and mounts `PortalHost`. Reusables `doctor`: all checks pass
- [x] F9.2 Components in `src/components/ui/`: button, text, input, textarea, label, card, separator, switch, checkbox, badge, dialog, alert-dialog, select, toggle, toggle-group, skeleton, progress, icon, native-only-animated-view
- [x] F9.3 Phase 1 migration: `OptionPicker`, `AmountInput`, `DateField`, `TimeField`, `ExpenseForm`, `ExpenseRow`, `FileTile`/`AddTile`, `LocalFilesPicker`, `AttachmentsSection`, `CustomSignIn`, `ClerkAuthScreen{,.web}`, Settings (grouped rows, usage progress bars, AlertDialog for delete account)
- [x] F9.4 Phase 2 migration (2026-10-07): tabs layout (lucide tab icons, THEME tints), home, expenses (search `Input`, proof filter `ToggleGroup`), recaps + `charts.tsx`, plan tab (`ToggleGroup` segment), `PlanningView`, `FixedChargesView`, `PlannedRow`, `CompleteSheet`, `PlannedForm`, `RecurringForm`, planned/recurring screens, import history + review, `ImportItemRow` (Reusables `Checkbox`), `ItemEditModal`, expense new/detail, privacy, `AttachmentViewer`, `UploadOverlay`. No `StyleSheet` left outside `src/components/ui`; remaining inline styles are data-driven only (chart sizes, category colours). Recap "fixed vs variable" bar uses warning (fixed) / primary (variable) since the old purple has no token
- [x] F9.5 Dark mode (2026-10-10): the app follows the system setting. Root layout picks `NAV_THEME` from `useColorScheme()`, `StatusBar style="auto"`, web mirrors the media query via `colorScheme.set('system')` in an effect; `useThemeColors()` in `src/lib/theme.ts` replaces every `THEME.light.*` read (spinners, icons, tab tints). Clerk's prebuilt web `<SignIn>` still renders light (would need `@clerk/themes`)
- [x] F9.7 Skeleton loaders (2026-10-10): every screen that waits on the API shows a placeholder shaped like its content instead of a centred spinner. Shared pieces in `src/components/skeletons.tsx` (`ExpenseListSkeleton`, `PlannedListSkeleton`, `GroupSkeleton`, `FormSkeleton` + `FORM_LAYOUTS`, `TileStripSkeleton`, `AttachmentsCardSkeleton`, `loadingA11y`); screen-specific ones sit next to their screens (home tiles, recap cards, planning months, fixed charges, planned detail, import history and review). Spinners remain only for actions (buttons, uploads), the AI steps (import extraction, recap narrative) and Clerk's session restore. Skeleton colour is `bg-border` (our `accent` is blue)
- [ ] F9.6 Bundle size: Metro does not tree-shake `lucide-react-native` (bundle grew ~2.5k → ~4.5k modules); switch to per-icon imports or enable Expo tree shaking before a store release


### E11 — Client data cache (D15)
- [x] F11.1 `src/lib/query.ts`: `queryClient` (60 s stale, 30 min gc, retry 1), hierarchical `keys`, `invalidate.{expenses,plans,imports,attachments}`, `useRefetchOnFocus`, `errorMessage`; `QueryClientProvider` in the root layout; cache cleared on sign-out; AppState → `focusManager`
- [x] F11.2 Hooks on the cache: `useMe` (optimistic prefs mutation), `useCategories`, `useExpenses` (`useInfiniteQuery`, `keepPreviousData` while searching, optimistic delete), `useUpcomingPlanned`, `useRecurringList`, `useRecap` / `useRecapOverview`, `useAttachments`
- [x] F11.3 Screens: home, expenses, plan, recaps, settings refresh in the background on focus; planning / month / fixed charges / import history and review / expense, planned and recurring detail read through `useQuery`; detail screens open from the tapped list row via `placeholderData`
- [x] F11.4 Fixed-charge materialisation (F6.3) runs once per session (`ensureMaterialized`, 6 h) and after a charge is created or edited (`markMaterializationStale`), instead of on every Plan visit
- [x] F11.5 Profile and categories prefetched in the tabs layout, so forms open without a loading state after the first seconds of a session
- [x] F11.6 Currencies hardcoded (D14): `src/lib/currencies.ts`; `/api/currencies`, `ReferenceRepository`, `seed.ts` and `db:seed` removed; zod schemas validate codes against the list; migration `0001_strong_nova.sql` applied to Neon 2026-10-10

### E10 — Export expenses (PDF / XLSX)
Registered 2026-10-10; not started. Download the ledger for a date range as a
spreadsheet or a printable statement.
- [ ] F10.1 `GET /api/expenses/export?from=&to=&format=pdf|xlsx` (+ optional `categoryId`, `hasAttachment`) through `ExpensesRepository`; same filters as F2.2; hard cap on rows (5 000) with a clear 400 for reversed / oversize ranges; `Content-Disposition` filename `xpens-ia_<from>_<to>.<ext>`
- [ ] F10.2 XLSX via SheetJS (already a dependency, F3.5): sheet **Expenses** (date, description, payee, category, amount as a number, currency, estimated, proofs) + sheet **Summary** (totals per currency and per category)
- [ ] F10.3 PDF: header (user, range, generated on), expense table, totals per currency and per category; DD/MM dates and per-currency amount formatting (D7). Library to add and register in §2: `pdf-lib` (pure JS, runs on EAS Hosting)
- [ ] F10.4 Export screen `app/export.tsx`: range shortcuts (this month, last month, this year, custom via `DateField`), PDF / XLSX toggle, preview line ("42 expenses · 315 000 FCFA" via `GET /api/expenses` count), Export button; entry points from the Expenses tab and Settings
- [ ] F10.5 Delivery: native saves to the cache dir then opens the share sheet (`expo-sharing`, to register in §2); web triggers a browser download
- [ ] F10.6 Tests: row selection by range, totals, empty range, mixed currencies
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
- Client data fetching goes through TanStack Query (D15): add a key under
  `keys` in `src/lib/query.ts`, read with `useQuery`, and call the matching
  `invalidate.*` after every write. No ad-hoc `useEffect` + `useState` fetches.
- Pure client logic that gets unit-tested must not import `@clerk/expo` or
  `react-native`; vitest runs in Node (see `src/features/auth/errors.ts`).
- UI: build with `src/components/ui/*` and Tailwind classes (D13). Add a missing
  primitive with the Reusables CLI instead of hand-rolling it. Import
  notifications only through `src/features/notifications/module.ts`
  (`expo-notifications` throws at import in Expo Go on Android, and its
  scheduling and listener APIs throw on web; both are treated as unsupported).
- When a feature ships: flip checkbox, name files, Changelog line, same commit.

---

## 8. Changelog

- 2026-10-10 — **Action sheets for confirmations (NativeWindUI pattern).**
  Delete expense / plan / fixed charge, skip a plan, remove a proof, pick a
  proof source and commit an import now open a native action sheet
  (`useActionSheets`) instead of `Alert.alert`.
  Android and web render the sheet over a blurred, dimmed backdrop
  (`expo-blur`); iOS keeps the system sheet, which blurs on its own.
- 2026-10-10 — **Planned reminders are now the day before and at the planned
  time** (T-24h, T-0; the one-hour-before reminder is dropped). The plan form
  states the Expo Go / web limitation instead of promising a reminder.
- 2026-10-10 — **Duplicate compare-and-keep-one (F3.14)** and a detection
  fix: committed lines no longer flag the expense they themselves created.
- 2026-10-10 — **Imports work from Expo Go on Android.** The picker no
  longer copies into Expo Go's cache (unreadable from a project sandbox);
  the file is staged from its `content://` URI into our own cache. The
  review screen polls while the server processes, so a dropped phone
  request no longer looks like a failure; extraction budget 8 192 → 16 384
  tokens (a 37-row sheet used 8 096) with an 8-minute, no-retry timeout;
  SDK timeouts get a readable failure reason.
- 2026-10-10 — **S3 storage live (F0.12).** Bucket, CORS and IAM user
  created by the owner; `.env` carries the key pair and `S3_BUCKET`. The e2e
  script gained an attachment round trip and a purge check (26/26 pass).
- 2026-10-10 — **Client cache (E11, D15) and hardcoded currencies (D14).**
  TanStack Query added; every data hook and screen reads through it, writes
  invalidate the affected families, tab screens refresh in the background on
  focus, detail screens open instantly from the tapped row, profile and
  categories are prefetched after sign-in. Fixed-charge materialisation runs
  once per session. The `currencies` table, its route, repository and seed are
  gone (migration 0001 applied); the list lives in `src/lib/currencies.ts`.
- 2026-10-10 — **Dark mode follows the system (F9.5)** and the recap summary
  card collapses: once a summary is shown, tapping its header folds it to the
  title (state resets when the period changes).
- 2026-10-10 — **Recap summary on demand.** `useRecap` no longer requests
  the AI narrative after the stats; the "In short" card offers a Summarise
  button (`loadNarrative`) and shows a stored summary immediately. Saves a
  model call per visit and keeps the quota for summaries the user asked for.
- 2026-10-10 — **Tab headers removed; home shell reworked.** The five tabs
  render without a navigation header (`headerShown: false`); `TabScreen`
  (`src/components/tab-screen.tsx`) applies the status-bar inset instead. The
  Expenses import button moved from the header to the search row. Home: "Add
  expense" is now a floating button like the Expenses tab, the Recaps shortcut
  is gone, "Import a file" stays as a single action. Export to PDF / XLSX
  registered as E10 (F8.5 promoted).
- 2026-10-10 — **Skeleton loaders replace page spinners (F9.7).** Home,
  expenses (incl. load-more), recaps, plan (upcoming, planning, fixed
  charges), planned month, settings, expense / planned / recurring create and
  detail, import history and review, and the proof strip now render
  layout-matching skeletons while their data loads. Import review no longer
  shows "10 to 40 seconds" during the plain fetch; that message is kept for
  the AI step only.
- 2026-10-10 — **Runtime fixes from the first Expo Go session.** Root layout is
  wrapped in `GestureHandlerRootView` (swipe-to-delete rows crashed without
  it); `DateField` / `TimeField` use datetimepicker 9's `onValueChange` +
  `onDismiss` instead of the deprecated `onChange`; Reanimated strict-mode
  logging is off because gesture-handler 2.32's `ReanimatedSwipeable` reads
  shared values during render (re-enable when a fixed release ships).
- 2026-10-07 — **E9 phase 2: every screen on NativeWind + Reusables.** 27 files
  migrated (tabs, home, expenses, recaps and charts, plan and its views, forms
  and sheet, planned/recurring screens, imports, expense screens, privacy,
  attachment viewer, upload overlay). Ionicons remain only for category glyphs.
  Typecheck, lint, 53 tests, Android/iOS/web exports pass. Light mode still
  pinned; dark mode is F9.5.
- 2026-10-07 — **Notifications disabled on web.** The web build crashed after
  sign-in calling `getLastNotificationResponseAsync`; `module.ts` now reports
  web as unsupported (`notificationsUnavailableReason`), and Settings explains
  that reminders are available in the mobile app.
- 2026-10-05 — **E9 phase 1: NativeWind + React Native Reusables.** Setup,
  19 owned components, shared `FormField` / `Group`, and the phase 1 screens
  (form fields, expense form and row, attachment strips, sign-in, settings)
  migrated off `StyleSheet`. Light mode pinned until phase 2. All three
  platforms export; 53 tests pass.
- 2026-10-04 — **Clerk migrated to `@clerk/expo`** (prebuilt UI on web and in
  native builds, `CustomSignIn` fallback in Expo Go); **notifications made
  Expo Go-safe** behind `src/features/notifications/module.ts`; **EAS linked**
  and the first Android development build produced (pnpm pinned to 9.15.2,
  install-script allowlist in `package.json#pnpm` for CI).
- 2026-10-04 — **Renamed to xpens-ia** (display name, slug, package name, scheme
  `xpensia`, bundle id / package `ltd.nyota.xpensia`, default bucket
  `xpens-ia-files`). Clerk's Google redirect must allow `xpensia://sso-callback`.

- 2026-10-04 — **End-to-end API test passes 17/17** against the live stack
  (`pnpm test:e2e`, `scripts/e2e-api.mjs`; needs `pnpm start` running). Fixes
  from its first run: recap narrative `max_tokens` 400 → 2000 because
  reasoning consumed the whole budget; narrative and extraction now fail
  clearly on `finish_reason: length`; account deletion skips the S3 purge when
  storage is not configured. Corrected F3.3: image input works.
- 2026-10-04 — **Neon and TensorX connected.** Migration applied and
  currencies seeded on the live database; TensorX probe run (tool calling and
  JSON schema confirmed, image input not working on the default extract
  model). Env loader now treats empty values as unset and the S3 group is
  optional until the bucket exists (503 `storage_not_configured` on use).
- 2026-10-04 — **E7 ops built** (manual steps remain). `eas.json`, deploy
  runbook, privacy policy draft + in-app screen, AI quotas with `GET
  /api/usage`, maintenance sweep endpoint, client Sentry (DSN-gated).
  Remaining manual: `eas init` + deploy, host the policy, Neon project in
  `eu-central-1`, Clerk dashboard config, S3 bucket, TensorX key (F3.3).
- 2026-10-04 — **E5 planned expenses + E6 fixed charges complete.** Timezone
  helpers with tests; planned and recurring repositories and routes; one-batch
  completion that creates the expense and links receipts; local T-24h/T-1h
  reminders synced on load; Plan tab (Upcoming / Planning / Fixed charges);
  create, detail, month and fixed-charge screens; monthly materialisation of
  fixed charges. Closes F2b.8. 53 tests.
- 2026-10-04 — **E4 recaps complete.** Period helpers, SQL stats service,
  TensorX narrative, cached `GET /api/recaps` + `/overview`, recaps tab with
  View-based charts, home dashboard, opt-in local weekly/monthly reminders
  with a shared notifications module (also closes F5.4, F6.5). 49 tests.
- 2026-10-04 — **E3 file ingestion built** (F3.3 and F3.7 pending the TensorX
  key). Import presign/create/process/commit/items routes, `ImportsRepository`,
  parse → extract → stage pipeline with zod-validated model output, duplicate
  detection, reconciliation, history and review screens with inline edit.
  45 tests.
- 2026-10-04 — **E2b proof attachments complete** (except F2b.8, which lands
  with E5). Presign/confirm/url/delete routes, `AttachmentsRepository`,
  expense list `hasAttachment` filter and `attachmentCount`. Client: pickers,
  on-device compression, staged files, progress, retry, persisted offline
  queue, thumbnail strip, image viewer, PDF via in-app browser.
- 2026-10-04 — **E2 manual expenses complete.** Shared zod schemas
  (`src/lib/schemas/*`) used by form and API; expenses and categories routes
  with `withAuth` now forwarding route params and mapping `HttpError`;
  categories repository with default seeding; recap stale-marking; expenses
  tab with search, month totals, swipe-delete; create/edit screens; UUID v7
  and date helpers with tests (40 total).
- 2026-10-04 — **E1 auth complete.** Route guards with `Stack.Protected`; combined
  email-code sign-in-or-up plus Google SSO; tabs shell (home, settings);
  settings with currency/timezone pickers, sign out, delete account;
  `PATCH`/`DELETE /api/me`, `GET /api/currencies`; Clerk webhook handler;
  shared account-deletion service (also closes F2b.9). 23 tests. Manual: enable
  email code + Google in the Clerk dashboard, register the webhook endpoint.
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
