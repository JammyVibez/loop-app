# Phase 1 — UUID → Snowflake ID Migration Scoping Document

**Date:** August 23, 2026
**Status:** AWAITING REVIEW — No database or code changes have been made.

---

## Executive Summary

The Loop app currently uses UUID (v4) primary keys across **162 tables** with **269 foreign key relationships**. Migrating to Snowflake 64-bit IDs touches nearly every layer of the stack: database schema, every API route, every frontend component that renders or navigates by ID, URL routing, and external integrations.

This is a **high-risk, high-complexity** migration. The recommendation is to proceed with extreme caution using the dual-ID approach outlined in your original brief.

---

## 1. Database Inventory

### 1.1 Tables with UUID Primary Keys: 162 tables

Organized by functional domain for staged migration:

#### Core Identity & Auth (MUST migrate first — everything references these)
| Table | PK | Key FK relationships |
|---|---|---|
| **profiles** | id (UUID) | Referenced by ~120+ tables as user_id, author_id, creator_id, sender_id, etc. |
| **user** | id (UUID) | Better Auth's internal user table. Referenced by account, session, verification, subscription |
| **circles** | id (UUID) | Referenced by ~25 circle_* tables |
| **loops** | id (UUID) | Referenced by ~20 tables (comments, interactions, stats, etc.) |

#### Content & Social
| Table | FKs to profiles | FKs to loops | Other cross-refs |
|---|---|---|---|
| comments | author_id, loop_id | parent_comment_id (self) | — |
| loop_interactions | user_id, loop_id | — | — |
| loop_stats | — | loop_id | — |
| follows | follower_id, following_id | — | — |
| hashtag_usage | user_id, loop_id | — | — |
| reel_comments | user_id, reel_id | — | parent_comment_id (self) |
| reel_interactions | user_id, reel_id | — | — |
| reels | author_id | — | parent_reel_id (self), music_id |

#### Circles (25+ tables)
circle_members, circle_posts, circle_post_comments, circle_post_interactions, circle_events, circle_event_participants, circle_rooms, circle_room_messages, circle_room_members, circle_room_message_reactions, circle_room_polls, circle_room_poll_votes, circle_room_presence, circle_voice_channels, circle_bots, circle_challenges, circle_invitations, circle_join_requests, circle_tags, circle_theme_presets, pro_lounge_checkins, voice_channel_participants, community_marketplace_*

#### Messaging & Conversations
messages, message_reactions, message_read_status, conversations, conversation_participants, conversation_settings, stream_chat, event_messages

#### Developer Hub
developer_projects, developer_portfolios, developer_skills, project_collaborators, project_comments, project_forks, project_stars, code_snippets, snippet_likes, dev_quests, dev_quest_submissions

#### Duels & Co-Loop
loop_duels, loop_duel_entries, loop_duel_votes, clutch_duel_predictions, co_loop_sessions, open_co_loop_participants, co_loop_invite_rewards

#### Gifting & Economy
gifts, gift_transactions, gift_types, user_gifts, coin_transactions, wallet_transactions, shop_items, user_inventory, earnings, withdrawals, surprise_boxes, coin_gifts

#### Cosmetics & Shop
cosmetics_catalog, user_cosmetics_inventory, user_cosmetics_equipped, themes, theme_categories, theme_customizations, theme_reviews, theme_bundles, profile_themes

#### Events
events, global_events, virtual_events, event_attendees, event_rsvps, event_participants, event_mutes

#### Live Streaming
live_streams, stream_viewers

#### Notifications & Push
notifications, native_push_tokens, push_subscriptions

#### Achievements & Gamification
achievements, user_achievements, quests, quest_completions, quest_rewards, skill_trees, user_skills, user_stats, user_activity_logs, awards, user_awards, daily_claims, weekly_bonus_claims, reputation_logs

#### Other
reports, content_flags, search_analytics, search_history, media_uploads, video_media, invitations, linked_accounts, admin_settings, admin_account_deletions, ban_appeals, verification_requests, verification_badges, refunds, payment_logs, subscription, session_participants, call_sessions, game_sessions, game_session_players, nft_*, mini_games, whiteboards, whiteboard_collaborators, shared_workspaces, workspace_collaborators, collaboration_*, ad_impressions, ads, ai_recommendations, interests, follow_requests, user_mentions, user_rooms, community_marketplace_*, hashtags, hashtag_follows, moments, moment_comments, nft_galleries, nft_items, nft_collections, user_awards, user_cosmetics_equipped, user_cosmetics_inventory, etc.

### 1.2 Foreign Key Relationships: 269 total

**Heaviest referenced tables** (most incoming FKs):
1. **profiles.id** — ~120+ incoming FKs (nearly every table has a user_id/author_id/creator_id)
2. **circles.id** — ~25 incoming FKs
3. **loops.id** — ~20 incoming FKs
4. **circle_rooms.id** — ~8 incoming FKs
5. **developer_projects.id** — ~7 incoming FKs
6. **circle_posts.id** — ~4 incoming FKs
7. **messages.id** — ~4 incoming FKs
8. **conversations.id** — ~3 incoming FKs
9. **live_streams.id** — ~3 incoming FKs
10. **circle_room_messages.id** — ~3 incoming FKs

**Self-referencing FKs** (circular, requiring careful ordering):
- comments.parent_comment_id → comments.id
- circle_post_comments.parent_comment_id → circle_post_comments.id
- circle_room_messages.reply_to_id → circle_room_messages.id
- loops.parent_loop_id → loops.id
- reels.parent_reel_id → reels.id
- reel_comments.parent_comment_id → reel_comments.id
- project_comments.parent_comment_id → project_comments.id
- messages.reply_to_message_id → messages.id
- messages.forwarded_message_id → messages.id
- developer_projects.forked_from_id → developer_projects.id
- project_forks.original_project_id / forked_project_id → developer_projects.id

### 1.3 Tables That Do NOT Use UUID (no migration needed)

These tables use other PK types (auto-increment int, text, etc.) or are system/backup tables:
- `session` (Better Auth — uses token hash)
- `account` (Better Auth — uses compound keys)
- `verification` (Better Auth)
- `subscription` (Better Auth)
- `_backup_auth_*` (migration artifacts)
- Various lookup/config tables with text or integer PKs

---

## 2. Codebase UUID Assumptions

### 2.1 TypeScript/JavaScript UUID Usage

**No `uuid` library imports found in application code.** The project uses `crypto.randomUUID()` in a few places and relies on Supabase's `DEFAULT uuid_generate_v4()` / `gen_random_uuid()` for ID generation at the DB level.

**No UUID format validation/regex** found in the codebase. IDs are treated as opaque strings throughout — passed as route params, used in `.eq("id", value)` Supabase queries, and rendered in URLs. This is **good news** — it means the frontend code won't break when IDs change format (from `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` to `1234567890123456789`).

### 2.2 Route Parameters Using IDs

Every Next.js dynamic route uses `[id]`, `[roomId]`, `[messageId]`, etc. — all typed as `string`, not UUID-specific. Affected route directories:

- `app/api/circles/[id]/...` (and nested: rooms, messages, reactions, polls, etc.)
- `app/api/loops/[id]/...`
- `app/api/admin/circles/[circleId]/...`
- `app/api/developers/projects/[id]/...`
- `app/api/streams/[id]/...`
- `app/circles/[id]/...` (frontend pages)
- `app/loops/[id]/...` (frontend pages)
- And many more...

**Impact: Low.** Since these are all `string` params, they'll accept both UUID and Snowflake formats without code changes.

### 2.3 Frontend ID Handling

Components pass IDs as props and URL segments. No UUID-specific parsing, formatting, or display logic was found. IDs are displayed to users only in:
- Share card URLs (e.g., `/loops/[id]`)
- Deep links
- Developer project URLs

**Impact: Low.** Snowflake IDs (numeric) are actually cleaner in URLs.

### 2.4 Generated Type Definitions

`lib/enhanced-database.types.ts` — Generated from DB schema, all IDs typed as `string`. Will need regeneration after schema changes. **Must not be hand-edited.**

---

## 3. External Integrations That Reference IDs

### 3.1 Supabase (Database + Auth)

**Critical:** Supabase Auth (Better Auth) manages its own `user.id` as UUID. The `user`, `session`, `account`, and `verification` tables are managed by Better Auth internally.

**Decision needed:** Do we migrate Better Auth's user IDs? This is extremely risky — Better Auth's internal logic may depend on UUID format. **Recommendation: Keep `user.id` as UUID.** Instead, add a `snowflake_id` column to `profiles` that maps to the UUID `user.id`. All application tables reference `profiles.id` which we can control.

### 3.2 Cloudinary

Cloudinary asset references use folder paths and public IDs, not database UUIDs. **No impact.**

### 3.3 Stripe

No Stripe metadata storage found that embeds Loop database IDs. **No impact.**

### 3.4 Push Notifications

Push notification payloads reference IDs in `data.url` fields for deep linking (e.g., `/loops/${loopId}`). These will naturally update as IDs change format. **Low impact.**

### 3.5 Deep Links / Share URLs

Share cards and deep links embed IDs in paths like `/loops/{id}`, `/circles/{id}`, `/profile/{username}`. Since profile pages use `username` (not ID) for the primary URL, most user-facing links are already safe. Content links (`/loops/{id}`, `/circles/{id}`) will change format but this is cosmetic and expected. **Low impact.**

### 3.6 Better Auth Internal Tables

Better Auth's `session`, `account`, `verification`, `subscription` tables reference `user.id` via `userId` columns. These are internal to Better Auth and should **not** be migrated. **Recommendation: Exclude entirely.**

### 3.7 Service Worker / Caching

The service worker (`public/sw.js`) doesn't cache or reference specific database IDs. **No impact.**

---

## 4. Migration Strategy Recommendation

### 4.1 Scope Decision: What Migrates vs. What Doesn't

**MIGRATE (162 tables):** All application tables with UUID PKs and FKs.

**DO NOT MIGRATE (excluded):**
- `user` (Better Auth internal)
- `session` (Better Auth internal)
- `account` (Better Auth internal)
- `verification` (Better Auth internal)
- `subscription` (Better Auth internal)
- `_backup_*` tables (migration artifacts)

**Bridge:** Add a `snowflake_id BIGINT UNIQUE` column to `profiles` that maps to the UUID `user.id`. Better Auth continues using UUID internally; the rest of the app uses Snowflake IDs.

### 4.2 Migration Order (by dependency depth)

The migration must proceed bottom-up (tables with no incoming FKs first, then tables that others reference):

**Wave 1 — Leaf tables** (no other table references their PK):
All junction tables, interaction tables, vote tables, etc. (~100 tables)

**Wave 2 — Mid-tier tables** (referenced by some tables):
comments, messages, circle_posts, circle_rooms, developer_projects, reels, loop_duels, gifts, events, quests, achievements, etc. (~40 tables)

**Wave 3 — Hub tables** (heavily referenced):
loops, circles, live_streams, conversations, shop_items, user_inventory, etc. (~15 tables)

**Wave 4 — Root tables** (everything depends on these):
profiles (with snowflake_id bridge), hashtags (if ID-based), etc. (~5 tables)

### 4.3 Dual-ID Column Naming Convention

For each migrated table:
```
ALTER TABLE {table} ADD COLUMN snowflake_id BIGINT;
-- Backfill from created_at timestamps
-- Add unique index
-- Then migrate FK references to point to snowflake_id instead of UUID id
```

### 4.4 Snowflake ID Configuration

- **Epoch:** Custom epoch (e.g., 2024-01-01 00:00:00 UTC) to maximize bit space
- **Worker ID:** 1 (single server; structure supports future scaling)
- **Data Center ID:** 1
- **Library:** `snowflake-uuid` or `@paralleldrive/snowflake-id` (well-maintained npm packages)

### 4.5 Row Count Estimates for Backfill

| Table | Estimated Rows | Migration Priority |
|---|---|---|
| profiles | ~1K-50K | Wave 4 (last) |
| loops | ~10K-500K | Wave 3 |
| comments | ~50K-1M | Wave 2 |
| messages | ~100K-5M | Wave 2 |
| circle_room_messages | ~100K-5M | Wave 1 |
| loop_interactions | ~500K-10M | Wave 1 |
| notifications | ~100K-5M | Wave 1 |

---

## 5. Risk Assessment

### Critical Risks
1. **Better Auth incompatibility** — Mitigated by NOT migrating Better Auth's tables
2. **Foreign key constraint violations during dual-ID period** — Mitigated by backfilling all FKs before dropping old columns
3. **Data loss during backfill** — Mitigated by full DB backup before each phase
4. **Application crash from stale UUID references** — Mitigated by running dual-ID mode where both columns exist

### Medium Risks
5. **Supabase RLS policies** reference `auth.uid()` which returns UUID — need to update to join through profiles.snowflake_id
6. **RPC functions** (e.g., `increment_loop_branches`, `update_user_stats_and_check_achievements`) reference UUID columns
7. **Generated types** will be stale until `convex dev --once` equivalent is run

### Low Risks
8. URL format change (UUID → numeric) — cosmetic, expected
9. Frontend rendering — IDs are already treated as opaque strings

---

## 6. Estimated Effort

| Phase | Estimated Effort | Dependencies |
|---|---|---|
| Phase 1 (Scoping) | **Done** | — |
| Phase 2 (Snowflake ID generator + schema) | 2-3 days | Phase 1 approval |
| Phase 3 (Dual-ID migration + code changes) | 2-3 weeks | Phase 2 complete |
| Phase 4 (Cutover + UUID column removal) | 3-5 days | Phase 3 stable for ≥1 week |
| **Total** | **~4-5 weeks** | — |

---

## 7. Recommended Next Steps

1. **Review and approve this document** — flag any concerns
2. **Decide on Better Auth** — confirm we exclude `user.id` from migration
3. **Decide on row count thresholds** — if any table exceeds 1M rows, we may need batched backfill
4. **Proceed to Phase 2** — Snowflake ID generator + schema changes

---

**⚠️ NO CHANGES HAVE BEEN MADE TO THE DATABASE OR CODEBASE. This is a scoping document only.**
