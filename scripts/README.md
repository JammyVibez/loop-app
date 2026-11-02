# Database scripts

This folder has accumulated many overlapping SQL files from different
points in the project's history. **Not all of them run against a real
environment.** Before adding a new `.sql` file here, read this first.

## The canonical path

`scripts/run-production-setup.mjs` is the production schema setup runner
(`npm run db:setup:production`). It applies files in this exact order:

1. `schema-compat-alignment.sql`
2. `complete-database-setup.sql`
3. `premium-subscriptions-migration.sql` — Pro subscription ledger, Stripe
   identifiers/periods, and auditable grant metadata.
4. `launch-schema-alignment.sql`
5. `loops-and-media.sql`
6. `moderation-schema.sql`
7. `circles-schema-alignment.sql`
8. `enhanced-database-schema-part2.sql`
9. `enhanced-database-schema-part3.sql`
10. `wallet-and-events-schema.sql`
11. `developer-features.sql`
12. `co-loop-sessions-schema.sql`
13. `message-reactions-schema-fix.sql`
14. `dm-read-receipts-compat.sql`
15. `messages-edit-forward-schema.sql`
16. `circles-enhancements-schema.sql`
17. `fix-circle-event-participants.sql` — repairs the event participant foreign
    key, removes orphan RSVP rows, and ensures one RSVP per event/member.
18. `circle-event-rsvp-lifecycle.sql` — installs the row-locked RSVP RPC that
    prevents capacity races and synchronizes attendee counts.
19. `dev-quests-schema.sql`
20. `developer-hub-v2.sql`
21. `dev-collaborators-schema.sql`
22. `dev-repo-schema.sql`
23. `rls-policies.sql`
24. `realtime-functions.sql`
25. `coin-packs-refunds-schema.sql`
26. `fix-profiles-cosmetics-column.sql`
27. `private-profiles-schema.sql`
28. `native-push-schema.sql`
29. `clutch-duel-ads-tags-schema.sql`
30. `awards-pro-circle-moments-schema.sql`
31. `events-moderation-schema.sql`
32. `custom-checkmarks-schema.sql`
33. `update-coin-packs.sql`
34. `open-co-loop-invites-schema.sql`
35. `curated-emojis-schema.sql`
36. `add-is-spoiler-column.sql`
37. `explore-reels-indexes.sql`
38. `community-chat-post-enhancements.sql`
39. `community-fixes-2026-09.sql`
40. `community-admin-settings-2026-09.sql`
41. `fix-duel-votes-type.sql`
42. `fix-poll-option-id-type.sql`
43. `fix-poll-votes-poll-id-type.sql`
44. `community-chat-schema.sql`
45. `community-post-enhancements.sql`

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

1. Prefer extending an existing canonical file (idempotent
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) over creating a new one.
2. If a new table is unavoidable, add it as a new idempotent `.sql` file
   and add it to the `files` array in `run-production-setup.mjs` in the
   same PR — a migration that isn't wired into the pipeline doesn't
   exist as far as any real environment is concerned.
3. Never seed fake/demo rows in a migration that's part of the canonical
   pipeline (see `developer-features.sql`'s history — it used to insert
   a canned sample project).
