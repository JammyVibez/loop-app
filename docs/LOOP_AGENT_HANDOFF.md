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
- Rust formatting, compilation/check and all 26 unit tests passed in the latest Rust workflow; Clippy failed on two collapsible-if lints in `chain_lifecycle.rs` and `drops.rs`.
- Frontend `npm run verify` and production build failed because `Sparkles` was used but not imported in `components/explore/explore-content.tsx`.
- Chains already have Rust create/list/detail/contribution routes, format-aware payload validation, contribution edit/revision history, fork/remix copying and a client-side Markdown/JSON export flow. Verify the current source before extending; revision restoration and more complete moderation/collaboration/integration remain follow-up work.
- Discover already has recent, following, community, creative, hashtag, Chain and event surfaces, plus a personalized feed based on public Loops liked/saved by the viewer and topic tags. It still needs stronger controls, diversity, universal search integration and privacy/edge-case tests.
- Drops already merges global events, hosted events, Circle events and Circle challenges, with source-level filtering and merged ordering. Verify SQL schema/authorization and cross-source pagination; time/state behavior and filter ordering need robust tests.
- The PR description also reports Collections, Rust API foundations, Circle event lifecycle, Inbox/group access checks, follow requests and Premium billing/receipt work. Treat each as an implementation claim to audit in source and workflows before marking it production-ready.
- Stripe dashboard/webhook settings and production infrastructure configuration remain external tasks unless separately verified. The Terraform plan must keep billable cloud resources opt-in.
- The blue verification review workflow and full Admin Dashboard remain roadmap work; Premium must never grant verification.

## 9. Completion standard

A feature is finished only when its real user journey works, object permissions and privacy boundaries hold, the UI is accessible and responsive, migrations are safe, errors are understandable, and the relevant tests and CI pass on the exact commit. A route, page, design mock, PR description or green type-check alone is not completion.
