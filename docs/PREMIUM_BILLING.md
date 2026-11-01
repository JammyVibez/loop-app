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
