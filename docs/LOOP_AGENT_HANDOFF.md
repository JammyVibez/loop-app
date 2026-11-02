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
