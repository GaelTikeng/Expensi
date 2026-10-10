# Neon + Drizzle notes

## Two connection strings, different jobs

Neon gives you a pooled and a direct URL. They are not interchangeable:

| Use | String |
|---|---|
| App runtime queries | `...-pooler.<region>.aws.neon.tech` |
| `drizzle-kit migrate` / DDL | direct (no `-pooler`) |

Running migrations through the pooler can hang on advisory locks. Keep both in
your env as `DATABASE_URL` and `DIRECT_URL`.

## Migrations

```bash
npx drizzle-kit generate     # writes ./drizzle/*.sql
npx drizzle-kit migrate      # applies against DIRECT_URL
```

Review the generated SQL before applying. drizzle-kit will happily emit a
destructive `DROP COLUMN` when it can't tell a rename from a delete — on a
column holding real expense data that is unrecoverable. When you rename,
answer the interactive prompt rather than accepting the default.

Enable `gen_random_uuid()` support:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Autosuspend

Lower tiers scale compute to zero after ~5 min idle. The next query pays a cold
start (roughly 500ms–2s). For a consumer app that lands as a visible hang on
first open. Options, cheapest first:

1. Render from local cache immediately, let the network fill in.
2. Keep a scheduled ping to hold the compute warm (cheap, slightly hacky).
3. Paid tier with autosuspend disabled.

## Region

Put the API in the same region as the Neon project. For users in Central Africa,
`eu-central-1` (Frankfurt) is the nearest Neon region — roughly 150–250ms RTT.
An API in `us-east-1` talking to a DB in `eu-central-1` adds a full extra
transatlantic hop to *every query*, which is the most common self-inflicted
latency bug in this setup.

## Tenant scoping

There is no RLS here — the API is the trust boundary. That means every single
query must filter by `userId`. Do not hand-write that filter at call sites; put
it in a repository layer that takes `userId` as a required constructor argument,
so an unscoped query is impossible to express.

## Test branch

Integration tests (`pnpm test:integration`) run the API route handlers against
a separate Neon **branch** so they can truncate tables freely. Create it in the
Neon console (Branches → New branch from `main`, e.g. `test`), copy its pooled
connection string into `.env` as `DATABASE_URL_TEST`, and add the same value as
the `DATABASE_URL_TEST` repository secret for CI. The test setup applies the
migrations itself and refuses to run if the variable is missing or equals
`DATABASE_URL`.

## Changing the schema (E13)

Every change to `src/server/db/schema.ts` ships with its migration in the same
commit, in this order:

```bash
pnpm db:generate     # writes migrations/NNNN_<name>.sql, meta/NNNN_snapshot.json and updates meta/_journal.json
# read the SQL: drizzle-kit guesses; a rename can come out as drop + add
pnpm db:migrate      # applies to the DIRECT_URL database (never through the pooler)
pnpm db:check        # confirms the schema and the migrations agree
```

Rules:
- Never edit a migration that has been applied anywhere (dev, test branch,
  production). Fix forward with a new migration.
- `drizzle-kit generate` may ask whether a column was renamed or dropped and
  re-created; answer carefully, the data depends on it.
- CI runs `pnpm db:check`; a schema change without its migration fails the
  `check` job and prints the SQL that is missing.
- The integration tests apply the whole folder to the test branch on every run,
  so a broken migration shows up there too.
