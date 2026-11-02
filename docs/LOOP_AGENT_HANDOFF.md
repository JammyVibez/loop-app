# LOOP Major Redevelopment — Agent Handoff

> Last reviewed: 2 November 2026. Active work remains on PR #1; this document is the durable continuation brief.

## Active repository and non-negotiable workflow

- Repository: `VireonNoctis/loop-app`
- Continue only on [PR #1](https://github.com/VireonNoctis/loop-app/pull/1), branch `redesign/experience-platform-foundation`.
- Do not create another PR, merge this PR, or push directly to `main`.
- Re-fetch the PR head and its checks before every implementation batch. Build commits from the latest branch head and use a non-forced, expected-SHA ref update.
- Keep the PR open and draft until the user-facing roadmap, release gates and required checks are genuinely satisfied.

## Product vision

**Create together. Discover everything. Connect through shared interests.**

LOOP is a collaborative creation platform, not another passive feed or follower-count product. Prioritize shared creation, meaningful contributions, useful discovery and communities that build things together.

Keep one coherent object graph across Loops, Branches, Chains, Circles, Drops, Collections, profiles and conversations. A Chain is a structured collaborative object, not a Loop reply tree. A Circle is a community home, not only a group chat. Co-Loop is live collaboration; Collections preserve and organize useful work.

Aim for a premium, tactile, accessible ecosystem with thoughtful motion and consistent interaction primitives. Do not copy another company's visual identity. Mobile is primary; public web and desktop remain first-class. Respect reduced motion, keyboard/screen-reader access, quiet hours and user-controlled discovery.

## Engineering invariants

- New domain APIs and durable workflows target Rust/Axum + PostgreSQL; media uses private object storage with authorization-aware delivery.
- Existing Next.js, Better Auth and Supabase routes remain during a staged, tested migration. Do not claim a backend cutover until every dependent path, migration and deployment is verified.
- Never create a second account/identity store. Resolve the existing Better Auth identity to the canonical profile ID.
- Authorization, membership, privacy and Premium entitlements must be server-authoritative and fail closed on missing keys, failed lookups or unknown states.
- Test owner, member, guest, pending, blocked, banned, revoked and stale-session boundaries as applicable.
- Validate input, bound pagination and payload sizes, rate-limit abuse-prone writes, preserve attribution and use transactions for multi-row lifecycle changes.
- Keep existing public URLs and deep links stable. Prefer small, reviewable changes and regression tests. Inspect CI failure logs and fix root causes.
- Premium never buys verification or algorithmic reach. Verification is independent of subscription status.
- The full Admin Dashboard is the final project area, after user-facing capabilities, moderation, audit events and permission rules are stable.

## Five active user-facing workstreams

All five remain **in progress** until their journeys pass the release gates below. A page, route, migration or green CI run alone does not make a workstream complete.

### 1. Chains — signature collaborative creation

Existing foundation includes Rust routes for Chain create/list/detail/contributions and lifecycle operations, migrations `0004_chains.sql`, `0005_chain_collections.sql` and `0006_chain_lifecycle.sql`, plus frontend hub/detail surfaces.

Finish and verify: format-aware contributions (text, media, lists/rankings, polls and structured payloads); contribution ownership, edits/revisions and attribution history; fork/remix provenance; pause/complete/archive transitions; Circle and member visibility; collection/profile/discovery integration; moderation/reporting, abuse limits and shareable public pages. Verify the full creator/contributor/guest journey against PostgreSQL, not only mocked routes.

### 2. Circles — the community layer

Existing foundation includes public/private discovery, join/request/cancel/leave paths, approval RPCs, role policy helpers, member management, discussions, Circle Events and activity surfaces.

Finish and verify: one consistent membership state machine; active-only staff permissions; owner transfer and safe deletion; custom roles/permission overrides; moderation/report/report history; private content and roster denial across every sub-route; notification consistency; space/subcommunity navigation; atomic member counts and event capacity. Audit every route for service-role fallback and fail-open database errors.

### 3. Discover and Drops — the interest graph

Existing foundation includes search APIs, user-controlled discovery preferences, diversified recommendations, a Drops aggregation API and dedicated Drops pages.

Finish and verify: universal search across people, Loops, Chains, Circles and Collections; public/unlisted/private boundaries in results, counts and previews; category, interest, community, chronological and personalized modes; clear recommendation explanations and mute controls; useful pagination and empty/error states; Drops links to their source event, Circle or Chain. Personalization must remain optional and never be pay-to-amplify.

### 4. Living Profiles and Collections

Existing foundation includes profile privacy, identity/profile pages, earned-achievement showcase, profile customization and collaborative Collections with invitation lifecycle.

Finish and verify: a coherent showcase for interests, Chains, contributions, Circles, projects and Collections; per-surface privacy; blocked-pair and inactive-account behaviour; public previews that expose no restricted data; safe customization on mobile; Collection owner/editor/member permissions, invitation expiry/revocation and consistent source links. Public profile APIs must return deliberate DTOs, not unrestricted profile rows.

### 5. Connect and Co-Loop

Existing foundation includes DMs/group conversations, member-checked reactions/read receipts, Co-Loop invitations, room controls, text-operation collaboration, presence/chat and version history.

Finish and verify: durable invitations and revocation, active-session authorization for every read/write, permission changes taking effect immediately, conflict/reconnect/offline recovery, autosave and version restore, attribution, source-context links to Chains/Circles/projects, notification/outbox reliability and end-to-end multi-participant tests. Do not treat a realtime channel subscription as authorization.

## Later roadmap — not a reason to start the Admin Dashboard early

- Progression/creator tools: meaningful contribution-based achievements, creator analytics, templates, export and safe licensing/moderation.
- Premium: recurring billing, webhook lifecycle, server-authoritative benefits, cancellation and owner-bound receipts. Stripe dashboard keys, webhook registration and production database migrations remain deployment tasks; never claim these were applied by repository code alone.
- Verification: blue mark with public criteria, evidence review, appeal and anti-impersonation controls. Never tie it to Premium.
- Final phase: full Admin Dashboard, after all user-facing systems and moderation/permission/audit foundations are ready.

## Release gates for each workstream

1. Main mobile and web journeys work end to end.
2. Server authorization and privacy are tested for owners, contributors, active members, pending users, guests, blocked pairs and revoked access.
3. Search, previews, metadata, notifications, exports and deep links do not leak private/unlisted content.
4. Migrations apply to a clean PostgreSQL database and a representative existing schema; transactional and concurrency behaviour is exercised.
5. Loading, empty, error, offline, retry and permission-denied states are handled.
6. Accessibility, keyboard navigation, reduced-motion and responsive layouts are verified.
7. Pagination, payload limits, rate limiting and performance are reviewed.
8. Required CI workflows pass on the exact proposed commit.

## Recent implementation notes

- Collections collaboration invitation lifecycle now distinguishes pending/accepted/declined, supports owner cancellation and member response, and withholds private editor access until acceptance.
- Premium retry uses an idempotency key; the paid algorithmic reach boost was removed.
- Achievement/profile visibility and earned-achievement showcase tests were added; live PostgreSQL reward/migration checks remain release gates.
- Circle Events now require the server-only client and use an atomic RSVP lifecycle; real PostgreSQL concurrency checks remain release gates.
- This batch hardens Circle member APIs and private-Circle access: privileged routes require the server key, public member rosters return only deliberate identity fields, and private access fails closed when infrastructure or lookups fail.


## 69. Collaborative objects are now part of universal search — 2026-11-02

- Extended the existing search API to index public Chains and public Collections alongside people, Loops, hashtags and Circles.
- Search discovery excludes private/unlisted Chains and Collections, Circle-attached Chains (whose access depends on Circle membership), inactive/archived Chains and objects owned by blocked/restricted profiles. Owner lookup failures fail closed.
- Added dedicated Chain and Collection result cards and tabs, with stable links to their existing detail pages. Updated the search page description to reflect the broader object graph.
- Added route-level regression coverage for public-only visibility, Circle-scope exclusion and private/blocked owner filtering. CI on the exact head remains the verification gate.


## 70. Explore uses the same universal search contract — 2026-11-02

- Consolidated Explore search to consume the shared `/api/search` response for people, Loops, hashtags, Circles, Chains and Collections; Drops remain on their dedicated endpoint because they are a separately permissioned aggregation.
- Removed duplicate direct Chain and Collection search calls from the Explore search component, so public visibility and blocked/restricted-owner filtering are consistent between Explore and the dedicated Search page.
- Extended autocomplete suggestions to include Chains, Collections and Circles, with type-specific icons and concise context labels.


## 71. Circle auxiliary routes and Drops visibility — 2 November 2026

- Circle bookmarks, check-ins, tags and bot triggers now require server-side privileged access. Check-in status reads and writes both require active/approved membership; bookmark output is restricted to published posts and an explicit post/author field set.
- Circle bot triggers now require an active member; muted members are denied, moderation triggers are staff-only, and writing a bot response as a post requires the configured post-create permission (or staff).
- Individual Circle post detail no longer exposes pending content to non-staff users; interaction endpoints require active/approved membership.
- Circle-to-Loop feed sharing uses the server-only client and a current active/approved membership. Private Circles remain ineligible for public feed mirroring.
- Drops now includes events and challenges from public Circles, plus the viewer's own/private-active-member Circles; private content remains scoped to its owner or active/approved members.


## 72. Circle bot and check-in follow-up — 2 November 2026

- Circle bot configuration changes now require an active/approved membership instead of trusting a stale role field. Membership lookup failures are returned as unavailable.
- Bot-trigger post creation checks a well-formed explicit permission list before allowing non-staff members to create a post.
- Check-in history lookup failures no longer appear as an empty streak; the route reports the unavailable history rather than presenting a fabricated zero.
