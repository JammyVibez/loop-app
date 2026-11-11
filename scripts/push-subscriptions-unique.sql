-- Push subscriptions are keyed by endpoint: one row per browser subscription.
--
-- The live table only had a primary key on id, so `upsert(..., onConflict:
-- "endpoint")` failed with "no unique or exclusion constraint matching the ON
-- CONFLICT specification". Dedupe any existing rows, then enforce it.
--
-- Idempotent — safe to run repeatedly.

DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.endpoint = b.endpoint
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
  ON public.push_subscriptions (endpoint);

-- Native device tokens are keyed the same way (lib/fcm.ts upserts on token).
DELETE FROM public.native_push_tokens a
USING public.native_push_tokens b
WHERE a.token = b.token
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS native_push_tokens_token_key
  ON public.native_push_tokens (token);
