# Database scripts

This folder has accumulated many overlapping SQL files from different
points in the project's history. **Not all of them run against a real
environment.** Before adding a new `.sql` file here, read this first.

## The canonical path

`scripts/run-production-setup.mjs` is the production schema setup runner
(`npm run db:setup:production`). It applies files in this exact order:

1. `schema-compat-alignment.sql`
2. `complete-database-setup.sql`
3. `backend/migrations/0001_collections.sql` — ensure the shared profile/session,
   Circle, and Collection foundations exist for the Rust API.
4. `backend/migrations/0004_chains.sql` — canonical Chain, member and
   contribution tables.
5. `backend/migrations/0005_chain_collections.sql` — attach Chains to Collections.
6. `backend/migrations/0006_chain_lifecycle.sql` — remix lineage and immutable
   contribution revision history.
7. `premium-subscriptions-migration.sql` — Pro subscription ledger, Stripe
   identifiers/periods, and auditable grant metadata.
8. `launch-schema-alignment.sql`
9. `loops-and-media.sql`
10. `moderation-schema.sql`
11. `circles-schema-alignment.sql`
12. `enhanced-database-schema-part2.sql`
13. `enhanced-database-schema-part3.sql`
14. `wallet-and-events-schema.sql`
15. `developer-features.sql`
16. `co-loop-sessions-schema.sql`
17. `message-reactions-schema-fix.sql`
18. `dm-read-receipts-compat.sql`
19. `messages-edit-forward-schema.sql`
20. `circles-enhancements-schema.sql`
21. `fix-circle-event-participants.sql` — repairs the event participant foreign
    key, removes orphan RSVP rows, and ensures one RSVP per event/member.
22. `circle-event-rsvp-lifecycle.sql` — installs the row-locked RSVP RPC that
    prevents capacity races and synchronizes attendee counts.
23. `dev-quests-schema.sql`
24. `developer-hub-v2.sql`
25. `dev-collaborators-schema.sql`
26. `dev-repo-schema.sql`
27. `rls-policies.sql`
28. `realtime-functions.sql`
29. `coin-packs-refunds-schema.sql`
30. `fix-profiles-cosmetics-column.sql`
31. `private-profiles-schema.sql`
32. `native-push-schema.sql`
33. `clutch-duel-ads-tags-schema.sql`
34. `awards-pro-circle-moments-schema.sql`
35. `events-moderation-schema.sql`
36. `custom-checkmarks-schema.sql`
37. `update-coin-packs.sql`
38. `open-co-loop-invites-schema.sql`
39. `curated-emojis-schema.sql`
40. `add-is-spoiler-column.sql`
41. `explore-reels-indexes.sql`
42. `community-chat-post-enhancements.sql`
43. `community-fixes-2026-09.sql`
44. `community-admin-settings-2026-09.sql`
45. `fix-duel-votes-type.sql`
46. `fix-poll-option-id-type.sql`
47. `fix-poll-votes-poll-id-type.sql`
48. `community-chat-schema.sql`
49. `community-post-enhancements.sql`

The Premium migration runs after the profile table is created. Circle event
repair runs after the event/participant tables are created; the lifecycle
function follows it so RSVP writes cannot overbook capacity-limited events.

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

## One-off data-quality scripts (not schema, not in the pipeline)

`seed-user-realism.mjs`, `seed-engagement-realism.mjs`, and
`reconcile-profile-and-loop-stats.sql` were run once against the live
database to fix seed accounts that reused ~10 template sentences
verbatim across 20 profiles (duplicate bios, duplicate loop content,
sequential loop_coins), and to back their likes/comments/shares/branch
counts with real rows instead of decorative numbers (the same "no fake
engagement" principle applied elsewhere in the product). They're kept
here as a record of what changed, not as repeatable migrations — running
`seed-user-realism.mjs` again would just re-apply the same content
(harmless), but there's no reason to unless new template-duplicate seed
accounts show up. `reconcile-profile-and-loop-stats.sql` **is** safe and
useful to re-run any time counters drift, since it only recomputes from
real source-of-truth tables.

## Adding new schema

5. Prefer extending an existing canonical file (idempotent
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) over creating a new one.
6. If a new table is unavoidable, add it as a new idempotent `.sql` file
   and add it to the `files` array in `run-production-setup.mjs` in the
   same PR — a migration that isn't wired into the pipeline doesn't
   exist as far as any real environment is concerned.
7. Never seed fake/demo rows in a migration that's part of the canonical
   pipeline (see `developer-features.sql`'s history — it used to insert
   a canned sample project).
