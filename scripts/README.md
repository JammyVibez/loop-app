# Database scripts

This folder has accumulated many overlapping SQL files from different
points in the project's history. **Not all of them run against a real
environment.** Before adding a new `.sql` file here, read this first.

## The canonical path

`scripts/run-production-setup.mjs` is the only script that actually runs
against a fresh or existing database (`npm run db:setup:production`). It
applies files **in this exact order**:

1. `schema-compat-alignment.sql`
2. `complete-database-setup.sql` — base tables (profiles, loops, circles,
   messages, shop_items, gifts, achievements, admin_settings, …)
3. `launch-schema-alignment.sql` — payment_logs, conversations, reels,
   circle rooms, media_uploads, earnings, live_streams, …
4. `loops-and-media.sql`
5. `moderation-schema.sql`
6. `circles-schema-alignment.sql`
7. `enhanced-database-schema-part2.sql`
8. `enhanced-database-schema-part3.sql`
9. `wallet-and-events-schema.sql` — wallet_transactions, coin_gifts,
   withdrawal_requests (the real Stripe-backed coin economy)
10. `developer-features.sql` — developer_projects and related tables
    (the real Developers gallery)
11. `rls-policies.sql`
12. `realtime-functions.sql`

Every file in this list uses `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF
NOT EXISTS` so it's safe to re-run against a database that already has
some of this schema applied (verified against the live project database
during the Phase 1/3/5 hardening pass — zero data loss, idempotent
re-runs).

**If a table your code needs doesn't exist in a real environment, the fix
is almost always "add the migration file to the `files` array in
`run-production-setup.mjs`," not "write a new schema file no one runs."**
Two real bugs (missing `wallet_transactions`/`coin_gifts`/
`withdrawal_requests` and missing `developer_projects`) were exactly this
— fully-written SQL files that nobody had wired into the pipeline.

## Everything else in this folder

The remaining ~35 `.sql` files (`database-schema*.sql`,
`comprehensive-*.sql`, `enhanced-database-migration.sql`,
`co-loop-*.sql`, etc.) are **not** part of the automated pipeline. Some
predate it, some overlap with tables it already creates, and some were
one-off manual migrations. Treat anything not listed above as historical
reference, not a source of truth — if you need the tables/columns it
defines, verify what's actually live (`\d table_name` against the real
DB, or check `information_schema.columns`) and, if genuinely missing,
add an idempotent migration to the canonical list instead of running the
old file directly.

## Adding new schema

1. Prefer extending an existing canonical file (idempotent
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) over creating a new one.
2. If a new table is unavoidable, add it as a new idempotent `.sql` file
   and add it to the `files` array in `run-production-setup.mjs` in the
   same PR — a migration that isn't wired into the pipeline doesn't
   exist as far as any real environment is concerned.
3. Never seed fake/demo rows in a migration that's part of the canonical
   pipeline (see `developer-features.sql`'s history — it used to insert
   a canned sample project).
