# LOOP Pro billing setup

## Billing model

- Card checkout creates a recurring Stripe subscription: monthly plans renew monthly and annual plans renew yearly.
- Users can cancel or update a card subscription in the Stripe Billing Portal, opened through the authenticated /api/premium/portal route.
- Loop Coin access remains a separate prepaid pass; it does not auto-renew.
- Premium status is derived from active or trialing Stripe subscriptions, or a separately active prepaid/admin grant. Cancelling a Stripe subscription does not erase a separate active grant.

## Supabase migration

Run scripts/premium-subscriptions-migration.sql against the Supabase project before enabling recurring checkout. It creates or extends the subscription ledger and adds Premium grant-source fields to profiles.

## Stripe configuration

Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the server environment. Enable the Stripe Billing Portal in the Stripe dashboard. Configure the webhook endpoint as /api/payments/webhook and subscribe to:

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- payment_intent.payment_failed

The subscription metadata contains the LOOP profile ID and plan ID. The webhook verifies Stripe's signature before syncing it. The receipt endpoint independently checks that the Checkout Session belongs to the signed-in user before showing its receipt.

## Checkout confirmation

The success redirect carries the Stripe Checkout Session ID to /premium. LOOP retrieves that session server-side, checks its owner and subscription state, synchronises the subscription ledger, then displays the receipt. A client-side success URL alone never grants Premium.


## 62. Premium expiry and subscription ledger access on fresh schemas — 2026-11-02

- The base `complete-database-setup.sql` profiles table did not define `premium_expires_at`; the recurring billing migration now creates that column idempotently alongside its grant-source fields.
- Explicitly revoked direct public/anon/authenticated access to the subscription ledger and granted CRUD only to the server service role. Authenticated users continue to read their own billing state through server-authenticated APIs.
- Fresh and existing database migration execution remains to be verified against actual PostgreSQL environments.


## 63. Latest CI fixes — Collection result visibility and deterministic month labels — 2026-11-02

- Made the Rust Collection invitation response DTO public because it is returned by a public Axum handler; the API struct fields remain private.
- Stabilized the creator-revenue month test with an explicit US short-month locale. The test expected the three-letter `Sep` label but `en-GB` emits `Sept` in Node's ICU data; this was a test-fixture locale mismatch, not an analytics calculation error.


## 64. Premium retry safety and honest entitlement presentation — 2026-11-02

- The Premium page now retains an `Idempotency-Key` for a Coin purchase attempt across transient failures and reuses it when the member retries the same plan. The key is cleared only after the server confirms success; choosing a different plan starts a new attempt.
- The active-Pro summary lists only perks whose entitlement is currently enforced. Unfinished perks are clearly labelled “In development · Not available yet” in the upgrade comparison instead of being presented as already unlocked.
- Removed the proposed paid algorithmic reach boost entirely; discovery remains relevance-based and transparent, not pay-to-amplify.
- Removed the unused collaboration flag from the Collection member-removal handler, resolving the Clippy `-D warnings` failure reported in the previous Rust run.


## 65. Reliable progression and achievement profile privacy — 2026-11-02

- Added the previously omitted achievement/stat lifecycle to the planned production setup; the companion integrity migration is committed separately.
- Achievement profile reads now validate the requested UUID and enforce active-account, block and private/follower visibility boundaries. Public responses select only intended progression counters instead of returning every user_stats column.
- Added focused visibility policy tests for self, public profiles, approved followers, pending followers, blocked pairs and inactive accounts.
- PostgreSQL migration execution, event trigger backfill and real database reward idempotency checks remain release gates.
