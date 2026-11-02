# LOOP — Persistent AI Agent Handoff

> **Purpose:** This is the durable continuation brief for any AI agent or developer joining the LOOP redevelopment in a new chat or fresh workspace. Read it before changing code. Do not rely on a short chat summary or assume a previous agent's claimed completion is proof.

## 1. Read these sources first

1. `AGENTS.md` — mandatory working rules and source-of-truth order.
2. `docs/LOOP_REDEVELOPMENT_MASTER_PLAN.md` — canonical product vision, feature model, phases and release gates.
3. `docs/PRODUCT_EXPERIENCE_ARCHITECTURE.md` — information architecture, user journeys and cross-product integration.
4. This file — current implementation status, practical next actions and handoff details.
5. The live description, changed files, latest head and CI results of [PR #1](https://github.com/VireonNoctis/loop-app/pull/1).

The master plan and architecture document define the complete product. This handoff explains how to continue implementing them. Update this file whenever meaningful work changes the state of the roadmap.

## 2. What LOOP is

LOOP is a collaborative social platform built around **creating together, discovering people and interests, and building things that become more valuable through participation**. It is not a collection of unrelated mini-apps and should not be reduced to a conventional scrolling social feed.

The signature experience is collaborative creation:
- A person starts a Loop, Chain, project, prompt or shared activity.
- Other people can discover it, understand its context and contribute.
- Contributions remain attributed to their creators and can be discussed, revised and remixed with provenance.
- The result can become a public work, a reusable resource, a Collection item or the starting point for another collaboration.
- Circles give ongoing communities a place to organize this activity; conversations and notifications bring people back to the relevant context.

LOOP should reward meaningful creation, constructive participation, collaboration and community health—not passive consumption, follower competition, time spent, compulsive checking or raw notification volume. Make participation optional and healthy: no punitive streak loss, forced invitations, artificial scarcity, wagering or pressure notifications.

## 3. Complete product model

### Loops and Branches
- A **Loop** is a durable content object with an author, visibility, media, discussion and activity.
- A **Branch** explicitly extends or reinterprets a parent Loop. Preserve parent attribution and keep the relationship navigable.
- Loops should be shareable, discoverable and reusable in Collections and Circles without re-uploading or duplicating the original object.
- The existing Reels/trees surface is not the Chain system. Do not rename or repurpose it as Chains.

### Chains — the signature collaborative object
A Chain is a structured, evolving activity created by one person and developed by many. It has a stable identity, title, description, opening prompt, cover, format, creator, contributors, contribution policy, visibility, history and a shareable result.

Initial and future formats include collaborative stories, fictional universes/worldbuilding, rankings, playlists, galleries and photo prompts, recommendation lists, community projects, polls, documents, links and open-ended collections. The data model must remain format-aware and support text, image, video, audio, links and structured payloads.

Required lifecycle:
- Create, discover, view and contribute, including threaded/branched contributions.
- Preserve attribution, ordering and author identity.
- Edit a contribution without erasing the previous version; expose revision history and safe restoration.
- Fork/remix a Chain with visible source attribution and correct parent-child contribution mapping.
- Provide reusable templates, role-based collaborators, moderation/reporting and rate limits.
- Support asynchronous contributions first, then live Co-Loop editing with presence, invitations, conflict handling, autosave and version history.
- Export/share the result in useful formats and provide clear public previews.

### Circles
A Circle is a living interest-based community, not merely a group chat. It has identity, artwork, guidelines, members, roles, permissions, spaces/subcommunities, discussions, Chains, Collections, Drops, events, projects and activity.

Public, unlisted and private access must be enforced on the server. Join requests, approvals, active membership, leaving, blocking and bans are distinct states. Circle roles and all owner/admin/moderator/member permissions must be checked server-side. Avoid duplicated identity or membership stores when connecting features.

### Discover
Discover is the interest graph for people, topics, Loops, Branches, Chains, Circles, Collections, creator work, projects and public activity. It should offer understandable modes such as recent/chronological, following, Circle/community, creative, topic/hashtag, Chain and personalized discovery.

Recommendations may use user-controlled interests, followed Circles, declared topics and public interactions. Explain *why* an item appears, allow users to influence or reset their signals, and never use private content or inaccessible profile activity as a recommendation signal. Preserve non-personalized alternatives.

### Drops
Drops are the optional activity layer for creative prompts, daily/weekly themes, polls, predictions, guessing games, seasonal activities, competitions and community-created events/challenges. Participation should be non-monetary and optional. Support discoverability, categories, search, state/time filters, sorting, reliable pagination, attendance/entries, voting where appropriate and clear start/end states. Do not turn them into wagering, punitive streaks or artificial scarcity.

### Profiles and identity
Profiles are evolving, privacy-aware personal spaces showing interests, Loops, Chains, contributions, Collections, Circles, projects and achievements. Profile surfaces and objects need independent privacy controls. Customization and cosmetics must not become a pay-to-be-authentic system.

Explore a blue identity-verification mark with a published eligibility standard, identity/impersonation safeguards, human review, appeals and revocation rules. Verification is about authenticity and is **never a Premium purchase or paid perk**.

### Collections
Collections organize Loops, Chains, Circles, people and external references. They can be private, unlisted or public, and optionally collaborative with explicit owner/editor/member permissions. A save/add action should be available contextually from feeds and detail pages.

### Connect and Co-Loop
Messaging, groups, friend relationships, invitations, media/voice messages and shared activities belong to the same social graph. Conversations should link back to the Chain, Circle or project they concern. Co-Loop is live collaborative creation with presence, autosave, attribution and conflict-safe editing—not simply another chat room.

### Notifications and activity
One notification centre should serve follows, requests, Branches, replies, Chain contributions, revision/remix activity, Co-Loop invitations, Circle membership/events, Drops and Collection collaboration. Every notification needs a relevant actor, recipient, permission-aware deep link and user-controlled delivery preference. Add grouping, quiet hours and digests; avoid duplicate or spammy fan-out.

### Events, Live and creator tools
Events and Live experiences should connect to Circles, Drops, profiles, Chains and conversations. Creator tools should help people organize, publish, understand and reuse their work. Add creator analytics, advanced templates, showcases, remix/fork tools and public developer integrations only after the shared object and permission model is stable.

### Progression and recognition
Celebrate useful contributions, creative milestones, community accomplishments and collaboration. Prefer meaningful recognition over time-spent rewards, follower counts, streak pressure, paid random rewards or wagering. Cosmetics may express identity but must not confer trust or moderation authority.

### Premium, payments and receipts
LOOP Premium is a recurring subscription product with server-authoritative entitlements, monthly/yearly billing, checkout, webhook lifecycle synchronization, billing history, cancellation and account-bound receipt access. A payment provider—not a visual animation—handles payment processing. The Dqnamo Kitchen Receipt Printer experiment is an interaction/receipt presentation reference only; implement an original LOOP experience unless reuse rights are explicitly established. Keep prepaid Loop Coin passes and legacy one-time grants separate from recurring Premium. Never sell verification.

### Sharing and public web
Public Loops, Chains, Circles and Collections need durable URLs, correct metadata and high-quality share previews. A visitor should be able to understand public work on the web before installing the app. Joining, contributing or continuing in the app should be a contextual next step. Private objects, profile fields and inaccessible Circle content must not leak through search, Open Graph metadata, previews or recommendation endpoints.

### Admin Dashboard — last
The full Admin Dashboard is a major project area but is intentionally the **final implementation phase**. Build it only after user-facing systems, permissions, moderation, audit events, billing/verification policy and operational metrics are stable. It must be a secure control plane, not a bypass around domain authorization.

## 4. Connected-platform requirement

Treat LOOP as one connected product with a shared identity and canonical object graph—not as a visual copy of another company's ecosystem. Every feature should reuse the same account, permission rules, search, notifications, deep links, media pipeline, saved/Collection model and design primitives where appropriate.

Concrete connected journeys:
1. A public Loop is discovered, followed, discussed, saved to a Collection, shared into a Circle and branched without duplicating the source.
2. A Circle prompt or Drop can start a Chain; members contribute; each author receives attribution; the completed Chain is discoverable, shareable and addable to Collections.
3. A Chain contribution or remix appears on the contributor's profile according to privacy rules and links back to its source.
4. A Circle event or Drop can be discussed in its contextual conversation; RSVPs/entries and permissions remain consistent.
5. A Co-Loop session can start from a Loop or Chain, invite collaborators, preserve autosaved revisions and publish the result back into the originating context.
6. A notification always opens the exact permitted object/action that caused it; universal search returns only objects the viewer can access.
7. Saving, sharing, following or joining should work consistently from feed cards, detail pages, search results and profiles.

Do not introduce a second source of truth for users, profiles, Circle memberships, entitlements, object visibility or interaction state. Share canonical IDs and typed APIs. Cross-feature integrations require authorization and privacy tests, not only UI links.

## 5. Architecture and implementation constraints

- Target **Rust + Axum** for new durable backend domain APIs and **PostgreSQL** as the canonical relational store for those domains.
- Preserve the staged migration: existing Next.js routes, Better Auth and Supabase integrations remain until each domain has a tested migration and rollback plan. Do not claim a full backend cutover prematurely.
- Resolve authenticated users against the existing account/session/profile model. Do not create a parallel account or identity store.
- Use additive SQLx migrations; validate migration order and compatibility with existing production schema/data.
- Use S3-compatible object storage for media; local PostgreSQL + MinIO is the free development path. Enforce HTTPS for external references and validate uploaded media on the server.
- Authorization must be server-side on every read and write, including public previews, search, notifications, forks/remixes, exports and media references.
- Validate payload sizes, strings, URLs, pagination and enum values. Bind SQL parameters; never interpolate user input into SQL.
- Keep stable IDs, route paths and deep links; maintain compatibility with legacy paths during migration.
- Reuse shared tactile button/animated icon primitives where suitable. Motion must respect reduced-motion preferences, accessibility, touch targets and keyboard/screen-reader use.
- Design mobile-first while retaining excellent desktop/web creation, discovery and community experiences.
- Prefer small, reviewable, test-backed changes. Avoid speculative abstractions, broad rewrites and unrelated cleanup.

## 6. Working rules for every coding session

1. Work only in **VireonNoctis/loop-app**, in the existing **PR #1** branch `redesign/experience-platform-foundation`. Do not create another PR or push directly to `main`.
2. Before editing, fetch the live PR, branch head SHA, changed files and current CI runs. The branch may advance between chats; never rely on an old SHA.
3. Read the relevant implementation and migration/schema before changing a feature. The PR description is a summary, not proof that a feature is complete.
4. Keep the PR in draft until all requested scope and required checks are complete. Never merge it.
5. Make surgical changes with clear commits. For concurrent updates, use the current expected head SHA and avoid overwriting work that arrived after inspection.
6. Run or trigger the repository's real verification: `npm run verify`, `npm run build`, and in `backend/` `cargo fmt --all -- --check`, `cargo check --all-targets --all-features`, `cargo test --all-features`, and `cargo clippy --all-targets --all-features -- -D warnings`.
7. Inspect failure logs and fix root causes. Do not silence lint, skip tests, loosen CI or claim success based only on compilation.
8. Add tests for privacy, permissions, invalid inputs, empty states, pagination, state transitions and cross-feature journeys.
9. Update this handoff when implementation state changes. Mark an item complete only when the code exists and the relevant tests/checks pass on the exact PR head.
10. Never claim a feature, integration, database migration, payment configuration or deployment is complete unless it has actually been verified.

## 7. The six active workstreams — continue in this order

### 1. Stabilize the existing PR and CI
- Re-fetch the latest branch head and Actions runs.
- Fix all formatting, TypeScript, build, unit-test, Rust compile/test and Clippy failures.
- Review the actual diff for regressions, generated artifacts, schema assumptions and security/privacy issues.
- Confirm the checks refer to the exact new head after all commits.

### 2. Finish Chains as an end-to-end lifecycle
- Verify create/list/detail/contribution flows and format-aware validation.
- Complete revision restore with immutable history: restoration must first save the current version, validate the selected revision, authorize the original author, lock the contribution and update atomically.
- Verify fork/remix attribution, source links, copied contribution parent relationships, member/counter repair and visibility rules.
- Improve media previews, attachment lifecycle, templates and threaded contribution browsing.
- Add collaborator roles, moderation/reporting, rate limits and export/public preview safeguards.
- Plan live Co-Loop editing only with conflict handling, presence, autosave and version semantics.

### 3. Complete Discover
- Preserve Recent, Following, From Circles, Creative, Hashtags, Chains and Events as usable alternatives to personalized ranking.
- Improve personalized recommendations with explainable reasons, public-only signals, deduplication, diversity and user controls (mute topics, adjust/reset interests).
- Add universal search across people, Loops, Branches, Chains, Circles and Collections with permission-aware results and stable pagination.
- Connect result cards to follow/join/save/contribute/share actions without losing context.
- Test private profiles, blocked users, private Circles, unlisted content, empty signals and deleted source content.

### 4. Finish Drops
- Verify global events, hosted events, Circle events and Circle challenges against real schema and authorization.
- Make search/category/kind/live/upcoming/sort filters consistent between SQL and merged application ordering.
- Ensure deterministic ordering, deduplication, correct totals and has-more pagination across sources.
- Distinguish scheduled challenges, active challenges, live events and ended activity.
- Connect prompt/event/challenge participation to Circles, Chains, profiles, notifications and contextual discussions where the user has access.
- Add tests for time boundaries, invalid/conflicting filters, source visibility, pagination and sort stability.

### 5. Build the shared integration layer
- Establish canonical typed references/deep links across Loop, Branch, Chain, Circle, Drop, Collection, Profile, Event and conversation objects.
- Reuse identity, access checks, visibility, media, search, notifications, save/share actions and activity events.
- Connect create → collaborate → publish → discover → save/share → profile/Collection journeys.
- Ensure no duplicate upload/object/account state is created when users move between features.

### 6. Verify complete cross-feature journeys
- Add backend integration tests and frontend tests for real multi-step journeys, not isolated component snapshots alone.
- Cover authenticated/guest/member/non-member/creator/moderator cases and blocked/private/unlisted access.
- Verify migration setup on clean and representative databases, plus rollback documentation.
- Verify loading, empty, error, offline, reduced-motion, keyboard and mobile layouts.
- Run all required checks on the final PR head and document remaining external configuration/deployment tasks honestly.

After those six workstreams, continue the remaining user-facing roadmap phases. Implement the Admin Dashboard only after those phases and moderation/permission infrastructure are stable.

## 8. Verified starting snapshot — 2026-11-02

This is a checkpoint, not a promise that the branch will remain at this SHA. Always re-fetch before acting.

- Repository: `VireonNoctis/loop-app`
- Existing pull request: [#1 — Unify LOOP experience and establish Rust backend](https://github.com/VireonNoctis/loop-app/pull/1)
- Working branch: `redesign/experience-platform-foundation`
- Head observed during this handoff: `78d178ae8c2265cf7c592e1f343c1211e933a181`
- PR was open and draft. Keep it that way.
- Existing product documents already contain the broad philosophy, core object model, phases and release gates. This file makes that direction easier for a fresh agent to resume.

### Code and check observations on the observed head
- At the checkpoint commit `57fcc1e`, the previous Rust workflow had passed formatting, compilation and all 26 tests, but the new workflow then reported one rustfmt-only blank-line difference in `drops.rs`. The same commit also fixes the two previously reported Clippy lints; verify Clippy again on the next head.
- Frontend `npm run verify` and production build failed because `Sparkles` was used but not imported in `components/explore/explore-content.tsx`.
- Chains already have Rust create/list/detail/contribution routes, format-aware payload validation, contribution edit/revision history, fork/remix copying and a client-side Markdown/JSON export flow. This workstream is now adding atomic, author-only revision restoration with current-version preservation and access checks; verify its CI before treating it as complete.
- Discover already has recent, following, community, creative, hashtag, Chain and event surfaces, plus a personalized feed based on public Loops liked/saved by the viewer and topic tags. It still needs stronger controls, diversity, universal search integration and privacy/edge-case tests.
- Drops already merges global events, hosted events, Circle events and Circle challenges, with source-level filtering and merged ordering. Verify SQL schema/authorization and cross-source pagination; time/state behavior and filter ordering need robust tests.
- The PR description also reports Collections, Rust API foundations, Circle event lifecycle, Inbox/group access checks, follow requests and Premium billing/receipt work. Treat each as an implementation claim to audit in source and workflows before marking it production-ready.
- Stripe dashboard/webhook settings and production infrastructure configuration remain external tasks unless separately verified. The Terraform plan must keep billable cloud resources opt-in.
- The blue verification review workflow and full Admin Dashboard remain roadmap work; Premium must never grant verification.

## 9. Completion standard

A feature is finished only when its real user journey works, object permissions and privacy boundaries hold, the UI is accessible and responsive, migrations are safe, errors are understandable, and the relevant tests and CI pass on the exact commit. A route, page, design mock, PR description or green type-check alone is not completion.


### Follow-up implementation — Chains revision restore
- Added an author-only revision restore route that locks the contribution, checks current visibility/membership, validates the stored revision, saves the current version as a new immutable revision, restores the chosen version and updates Chain timestamps in one transaction.
- Contribution edit lookup now checks current Chain access in addition to author identity, preventing an author whose access has been revoked from editing by guessing the object ID.
- The revision-history UI now exposes an explicit restore action and refreshes both the contribution and history after success.
- Verify this feature with Rust CI and frontend CI on the exact head. No live collaboration/presence or moderation work is implied by this addition.


## 10. Latest continuation progress — 2026-11-02

The branch is still PR #1 and must remain a draft. Re-fetch its head before continuing.

### Completed in this continuation (verification still required on the final head)
- Fixed the missing Discover `Sparkles` import and the two Rust Clippy collapsible-if issues previously identified.
- Corrected Rust formatting whitespace in the Chains lifecycle and Drops tests.
- Added author-only contribution revision restoration. The current contribution is first written as a new immutable revision, then the chosen prior revision is restored in the same PostgreSQL transaction. The endpoint checks current Chain access, locks the contribution, validates the restored format/payload, and updates the parent Chain timestamp.
- Tightened contribution editing so an author who has lost access to a private/Circle Chain cannot continue editing it by ID alone.
- Improved personalized Discover ranking: profile privacy filtering occurs before ranking/page selection; ranking uses topic affinity, engagement, recency and a stable ID tie-break; creator diversity is capped at two items in the first pass, with a ranked fallback when few creators are eligible.
- Extracted creator diversity into `lib/discovery-ranking.ts` and added unit tests for diversity, fallback, non-positive limits, duplicate IDs and recommendation metadata normalization.
- Carried `discovery_reason` through `normalizeLoop` and displayed the reason above the relevant Discover card.
- Corrected Drops sorting tie-breaks and scheduled Circle Challenge handling. Scheduled challenges are returned in the upcoming filter and are not presented as live broadcasts; a Rust regression test covers this.
- Corrected the Drops card/detail status presentation so scheduled challenges show their start time and an “Upcoming” state, instead of misleadingly showing only a closing time or “Not accepting entries”.
- Expanded the shared Explore search interface to include Drops using the existing authenticated Rust Drops API. This deliberately reuses backend access filtering instead of introducing a separate search implementation.
- Connected Circle Drops to Chains. A Circle member can open a prefilled Chain composer from a Challenge page. The Chain create API verifies Circle membership and the challenge/Circle relationship in PostgreSQL before writing a server-generated `metadata.origin` reference. Chain detail displays a link back to that source Drop.
- Added Rust unit tests ensuring Drop-origin metadata is generated from verified server data and that clients cannot spoof the reserved origin field.

### Current verification caveat
- The Rust workflow had passed formatting and compilation on a predecessor head, but subsequent changes to the Chain-origin handler/tests mean that result does **not** verify the current code.
- Latest observed working branch head at the time this section was written: `d7013fc1a72b4b35ec26f4a3e9ce5a9d1d31a500`.
- Check Actions for this exact SHA. A later commit cancels earlier runs, so do not infer current status from the predecessor head.
- The frontend verification/build for the latest additions (Drops search, origin links, challenge state and new Discover tests) must also pass on the exact final head.

### Immediate next actions
1. Verify the latest-head Rust format/check/test/Clippy workflow and frontend verify/build workflow. Fix any remaining failures from their logs.
2. Validate the Chain-origin flow with an integration test or repository database test: valid Circle member + existing challenge succeeds; wrong Circle, missing challenge, former member and malformed IDs fail without creating a Chain.
3. Exercise revision restore against the database, including invalid historical payload, mismatched contribution type, concurrent edits, and an author whose Circle access was revoked.
4. Check the new Drops search request while logged out, while authenticated, and after auth changes; verify private Circles and inaccessible challenges never appear.
5. Extend cross-feature journeys to Collections, profile activity and contextual notifications using canonical object references.
6. Add full end-to-end tests for Drop → Chain → contribution → Discover → Collection/share and complete release-gate checks.

The six workstreams in section 7 remain active. None should be marked completely finished solely because these partial implementations exist.


## 11. Latest cross-feature continuation — 2026-11-02

These updates extend the existing six workstreams. They are implemented in the same draft PR; verify all behavior and checks on the current head before marking anything complete.

### New connected journeys
- **Drop → Chain:** Circle Challenge pages now offer a prefilled “Continue as a Chain” action to eligible Circle users. The Chain composer receives source context in the URL and submits a source Drop ID. The Rust create handler validates the metadata object, reserves `metadata.origin` for server-generated data, verifies Circle membership/ownership and confirms that the challenge exists inside that exact Circle before storing the source reference. Chain detail links back to the original Drop.
- **Circle owners:** the Challenge detail API now distinguishes `can_create_chain` from `is_member`. Circle owners can start a Chain even when they do not have a separate membership row; challenge entry submission keeps its stricter membership check.
- **Chain → Collection:** Chain detail has a “Save to Collection” action. It reuses the Collection API and canonical `collection_items.chain_id` model. Collection permissions and target visibility are checked in Rust; the existing Chain collection migration, unique index and Collection detail rendering already support this item type. Do not create another bookmark table or store duplicate Chain objects.
- **Universal search:** Drops are included in the existing Explore search result types and use the existing authenticated Rust endpoint. Search refreshes when account identity changes. Private/non-member visibility should be checked against actual API behavior and tested, not inferred solely from the UI.

### Current type-check fixes
A previous `npm run verify` exposed implicit-any errors in the personalized Discover candidate tag arrays and a missing `ArrowUpRight` import in the Drop → Chain action. The candidate list is now explicitly typed through privacy filtering and the icon import is present. Check the current Actions run for proof; the earlier failing run is not evidence of the latest result.

### Current continuation order
1. Fetch current PR head; inspect the exact latest Rust API and CI workflow runs.
2. Resolve any remaining TypeScript, build, Rust, test or Clippy failures without disabling checks.
3. Add/execute database-backed integration tests for source Drop validation and revision restoration.
4. Test Drop search and cross-feature visibility for logged-out users, public/private Circle members, owners, non-members and blocked users.
5. Extend contextual saves, activity and notifications across Chain/Drop/Collection/profile journeys using canonical IDs and server-side authorization.
6. Build proper multi-step integration/E2E coverage and verify the final head.

The product remains intentionally unfinished until these gates pass. Keep PR #1 open and in draft.

## 12. Security boundary hardening — 2026-11-02

- Removed the `requireAdmin` fallback that treated an email containing the word "admin" as an administrator. Admin access now requires the canonical `profiles.is_admin` value to be exactly `true`; missing profiles and lookup failures continue to fail closed.
- Added an integration-style guard test using the real `requireAdmin` function. It covers an attacker-controlled email containing "admin", moderator-only profiles, missing admin privileges and an explicitly authorized profile.
- This is a security foundation correction, not an Admin Dashboard implementation. Existing privileged API routes inherit the stricter guard; no dashboard UI or new admin capability was added.
- CI must be checked again on the resulting branch head before this change is considered verified.
## 13. Verification application integrity — 2026-11-02

- Added a shared verification-submission parser with an explicit allow-list of account categories, bounded personal/application text, and HTTPS-only supporting links without URL credentials.
- The application API now derives the applicant username from the authenticated canonical profile instead of trusting a client-supplied username; malformed bodies and invalid evidence links are rejected.
- Applicant history now returns only review status, dates and reviewer feedback. Legal names, evidence links and private application text remain confined to the reviewer surface.
- Removed unsupported eligibility claims from both verification entry points, including the hard-coded impersonation signal and the unverified ten-post threshold. The UI now explains the actual review focus and that LOOP Pro does not confer verification or priority.
- The API retains compatibility fallbacks for older verification schemas. Production database setup and transactional reviewer decisions still need separate verification before this workflow can be considered complete.
## 14. Verification review and schema lifecycle — 2026-11-02

- Added a focused, idempotent verification lifecycle migration and wired it into the canonical production setup immediately after the base schema creates profiles.
- The migration creates/extends the verification request table, constrains supported request categories and lifecycle states, adds review feedback/actor fields and indexes, detects duplicate pending requests before creating the one-pending-request index, and removes legacy direct-applicant RLS policies so private application data is accessed through the server-side service-role routes.
- Added a database function that locks a pending request, checks the reviewer against profiles.is_admin, changes the review state and (on approval) updates profiles.is_verified in the same transaction. The function is not executable by PUBLIC, anon or authenticated roles; only the service role receives execute permission when present.
- The admin review route now uses the strict shared admin guard and the atomic database function. A request cannot remain approved while the profile update silently failed. Notifications are best-effort after the committed decision.
- Applicant history now exposes the designated rejection_reason field rather than internal admin_notes. Verification settings correct their text-length control, evidence-link input type and signed-out/profile-unavailable form state.
- Validation coverage for the route payload is kept separate from admin capabilities. This remains a staged Next.js/Supabase workflow; it is not yet moved to the Rust API. The migration has not yet been executed against a live database in this development session.
## 15. Verification route coverage and applicant experience — 2026-11-02

- Added a focused route-level test plan for the actual admin decision handler: authorized decisions call the atomic review RPC, stale requests produce a conflict without sending notifications, invalid request IDs are rejected, and unauthorized reviewers never reach the database.
- Removed all existing RLS policies on the verification request table during setup, rather than only known legacy policy names. The server-side service role remains the sole application data path.
- Tightened the security-definer RPC search path to prefer pg_catalog and schema-qualified application tables.
- Added an optional HTTPS evidence-link field to the primary verification page, so both entry points submit the same supported application shape.
- Review remains a manual identity process independent of Premium. Appeals, independent reviewer auditing and live-database migration validation remain open before this workflow can be called release-ready.
## 16. Verification SQL review correction — 2026-11-02

- Corrected the policy-cleanup section to use explicit idempotent DROP POLICY statements for the three legacy applicant policies defined by the repository's older verification schema. This keeps the migration compatible with the production setup runner's dollar-quoted statement splitter.
- The SQL migration remains unexecuted against a live database. Review syntax and schema assumptions in an actual PostgreSQL/Supabase staging database before production rollout.
## 17. Fail-closed verification schema setup — 2026-11-02

- The production database setup runner now treats the verification lifecycle migration as strict. Its statement-by-statement fallback remains available for the other legacy migrations, but any verification migration statement error stops setup instead of being ignored by the generic legacy-schema compatibility rules.
- This prevents a missing profile relation, failed policy change or missing review function from being reported as a successful verification setup.
## 18. Verification RPC type contract — 2026-11-02

- Added the new verification review RPC signature to the shared Supabase Database type contract. The admin route is now checked against the migration's argument names and JSON return shape rather than requiring an untyped RPC call.
## 19. Public profile metadata privacy — 2026-11-02

- Added one shared profile-visibility predicate used by both the profile API and server-rendered profile surfaces. Legacy missing settings remain public; private/follower-only and unknown configured values are treated as restricted.
- Profile metadata no longer publishes private profiles' bios, profile pictures, verification mark or follower totals through Open Graph previews. Structured ProfilePage JSON-LD is omitted for suspended/deleted accounts and omits private profile signals.
- Added focused tests for public, unlisted, private, follower-only, legacy and malformed visibility settings.
- The profile API still provides the limited profile payload according to its existing private/block rules; remaining end-to-end cases for blocked users and content surfaces are still part of the cross-feature privacy test gate.
## 20. Private profile crawler exclusion — 2026-11-02

- Restricted profile routes now return noindex/nofollow crawler directives and do not emit ProfilePage JSON-LD. The public preview remains generic and does not contain private identifying metadata.
## 21. Moderation report and review integrity — 2026-11-02

- Unified the active content_flags submission/review path around strict allowlists for content type and reason, UUID validation, 1,000-character detail limits, malformed JSON handling and duplicate-pending report conflicts.
- The moderation queue now validates status filters and clamps pagination to 1–100 results with a bounded offset. Reporter notifications are accurately identified as receipts rather than mislabelled admin alerts.
- Review actions use a transactional database function that locks a pending report, verifies the canonical moderator/admin role and commits the report decision together with a profile suspension. Suspension is only possible for the actual profile report, requires a reason, cannot target the reviewing moderator, and moderators cannot suspend other moderators/admins.
- Suspension records the reason on the profile and uses the existing appeal process; the old unsupported seven-day banned_until write has been removed because its expiry semantics were not consistently implemented across account-status checks.
- Added a race-safe unique pending-report index after preserving legacy duplicate rows as dismissed audit records. The new migration is wired into canonical production setup and is strict/fail-closed.
- The detail endpoint no longer attempts to join a polymorphic content_id to profiles for every content type. The queue UI now exposes only supported content actions and asks for a reason before a profile suspension.
- Live database migration execution and end-to-end moderator/appeal validation remain release gates.
## 22. Moderation report privacy and queue refresh — 2026-11-02

- Enabled RLS on content_flags. Public direct access is revoked, authenticated SELECT is allowed only when the viewer's canonical profile is an administrator or moderator, and service-role server routes retain required CRUD access.
- The moderation panel no longer subscribes with a public-key browser client to report records. It refreshes through the server-authenticated moderator endpoint every 20 seconds and preserves its initial loading state only for the first fetch.
## 23. Atomic ban appeal decisions — 2026-11-02

- Added the account-status/ban-appeals schema to canonical production setup after community chat schema creation. The migration adds the missing account status fields, appeal indexes and a status constraint, and records server-only access to appeal data using RLS with no direct client policies.
- Added a SECURITY DEFINER appeal-review transaction. It locks the pending appeal, validates the canonical moderator/admin role, clears is_banned/ban_reason/suspension_reason/suspended_at when approving, then updates the appeal decision in the same transaction. Denials require a reason.
- Replaced the admin appeal route's previously separate appeal update and account unban with the transactional RPC. Queue status and pagination are validated; notifications are sent only after the decision commits.
- The appeal panel requires a reviewer reason before denial. Parser and route tests cover approval, required denial feedback, invalid requests, stale decisions and unauthorized reviewers.
## 24. Suspension timestamps and final appeal/report validation — 2026-11-02

- Profile suspensions now write the canonical suspended_at timestamp at the same time as is_banned and the suspension reason. The moderation migration adds that column itself, so it does not depend on the later account-status migration for the review function to run.
- Added the missing `reel` alias to the reported-content removal route; the moderation queue already offered the action for both `reel` and `reels`, so they now resolve to the same Loop storage table.
- Added parser tests for user-submitted appeals, including whitespace normalization, malformed/non-text reasons and the exact 2,000-character boundary.
- The account-status migration retains historical appeals and enforces only one pending appeal per user, allowing a later appeal after a prior decision without overwriting the audit trail.
## 25. Atomic Circle join lifecycle — 2026-11-02

- Added a row-locked join_circle database function after the Circle schema migration. It serializes joins per Circle, validates the canonical account is neither suspended nor deleted, respects Circle bans, keeps public/private join states distinct, prevents client-selected elevated roles, enforces max_members for public joins and updates member_count in the same transaction.
- The join API now uses the database outcome as the source of truth. Existing active/pending members do not trigger duplicate welcome effects; private requests notify Circle staff; successful public joins retain welcome bot/default Power/quest integrations after commit.
- Added route tests for atomic delegation, full-Circle conflict, already-member idempotency and private join request notification.
- Private join approvals still need the same row-locked capacity check; that is the next membership lifecycle step, rather than treating this join-request endpoint as complete.
## 26. Circle join approval lifecycle — 2026-11-02

- Private join approvals and rejections now use a second row-locked database function, sharing the Circle-row lock with public joins so `max_members` cannot be bypassed by simultaneous approvals or joins.
- The review function independently validates the reviewer’s active Circle role, owner/admin/moderator role hierarchy, target profile account status, pending request state, capacity and requested role. It prevents moderators from granting moderator/admin roles and only lets the Circle owner grant admin.
- Rejections now transition the join row to `rejected` instead of deleting it, preserving a membership-request audit trail and allowing a future re-application through the join function.
- The API calls the RPC and only sends the appropriate recipient notification after the transaction commits. Added route coverage for approval, rejection, capacity conflicts and invalid role requests.
## 27. Circle role authority cleanup — 2026-11-02

- Removed the now-obsolete API-side role promotion check and member-count sync import from the join-review route; the transaction is the authoritative policy gate and count updater.
- The Circle staff read gate now uses the canonical owner_id only, matching the row-locked review function rather than retaining creator_id access after ownership changes.
- Tightened pending membership identifiers to a canonical UUID pattern before calling the database.
## 28. Circle migration ordering and service-role boundary — 2026-11-02

- Moved the Circle membership lifecycle migration after the account-status migration so its locked functions are installed only after `profiles.is_banned` and `profiles.is_deleted` exist.
- Circle join and join-review routes now instantiate the server-only Supabase client and return 503 when the service-role key is absent. They no longer fall back to the public anon key for privileged membership mutations.