# LOOP repository agent instructions

Before any code change, read these files in order:

1. `docs/LOOP_AGENT_HANDOFF.md` — durable product brief, engineering rules, active workstreams and continuation snapshot.
2. `docs/LOOP_REDEVELOPMENT_MASTER_PLAN.md` — canonical full product vision and delivery phases.
3. `docs/PRODUCT_EXPERIENCE_ARCHITECTURE.md` — information architecture, core journeys and shared ecosystem model.
4. The live [PR #1](https://github.com/VireonNoctis/loop-app/pull/1), current branch contents, schemas and CI results.

## Non-negotiable project rules

- Continue only in the existing PR #1 branch: `redesign/experience-platform-foundation`. Do not create another PR, merge the PR or push directly to `main`.
- Re-fetch the PR head and CI before every batch. Never trust a SHA or status from an earlier chat.
- Preserve LOOP's full product idea: a collaborative creation platform with Loops, Branches, Chains, Circles, Drops, Discover, Profiles, Collections, Connect/Co-Loop, Events/Live, creator tools, progression, Premium, identity verification, sharing and public web.
- Build one connected platform: shared identity, object graph, permissions, media, search, notifications, saves/Collections and deep links. Do not create isolated feature silos or copy another company's branding/interface.
- Rust/Axum + PostgreSQL are the target for new domain APIs; keep existing Next.js/Better Auth/Supabase systems during staged, tested migration. Never create a parallel identity store or claim cutover without evidence.
- Keep Premium subscription entitlements server-authoritative. Payment UI references do not process payments. Verification is independent of Premium and cannot be purchased.
- The full Admin Dashboard is the final phase, after user-facing features, permission rules and moderation are stable.
- Think before coding; simplicity first; make surgical, test-backed changes; preserve working routes and public URLs.
- Enforce privacy and authorization on the server. Test private/unlisted content, Circle membership, blocked users, profile visibility, previews, exports, search and notifications.
- Respect accessibility, mobile ergonomics, keyboard/screen-reader support and reduced motion. Reuse LOOP's tactile/animated interaction primitives appropriately.
- Do not claim work is finished unless the feature journey and checks pass on the current PR head. Inspect actual failure logs and fix root causes.

For the exact next actions and current implementation state, follow the six ordered workstreams in `docs/LOOP_AGENT_HANDOFF.md`.
