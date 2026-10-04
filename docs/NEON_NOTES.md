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
