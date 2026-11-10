-- Gift-to-coin conversion
--
-- A received collectible can be exchanged for a server-defined number of
-- Loop Coins. The gift row is locked while converting, so two taps, two tabs
-- or a retry after a dropped response can never credit the balance twice.
--
-- The conversion amount is stored on the gift when it is sent
-- (`gift_value.coin_conversion`). Callers may not invent an amount: the
-- function validates the request against the stored value.
--
-- This file is idempotent.

-- ── 1. Ledger type ─────────────────────────────────────────────────────────
-- The live table has had several CHECK constraints over time. Rebuild the
-- allowed list with every type the app writes today plus gift_conversion.
DO $gift_conversion_type$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'coin_transactions'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%transaction_type%'
  ORDER BY con.conname
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.coin_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.coin_transactions
    ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
      'purchase',
      'gift_sent',
      'gift_received',
      'gift_conversion',
      'quest_reward',
      'weekly_bonus',
      'daily_checkin',
      'onboarding_bonus',
      'admin_grant',
      'admin_reward',
      'premium_purchase',
      'refund',
      'level_reward',
      'earning_payout',
      'boost_spent',
      'co_loop_invite_reward',
      'pro_lounge_checkin',
      'clutch_duel_stake',
      'clutch_duel_winnings',
      'dev_quest_reward'
    ));
END
$gift_conversion_type$;

-- ── 2. Atomic conversion ───────────────────────────────────────────────────
-- gifts.id is a Snowflake/BIGINT id in this schema, while coin_transactions
-- reference ids are UUIDs. Use TEXT for the gift key so the function works
-- across both id eras, and let the locked gift row provide idempotency.
DROP FUNCTION IF EXISTS public.convert_gift_to_coins(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.convert_gift_to_coins(
  p_user_id UUID,
  p_gift_id TEXT,
  p_coins INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $convert_gift_to_coins$
DECLARE
  v_gift public.gifts%ROWTYPE;
  v_value JSONB;
  v_profile public.profiles%ROWTYPE;
  v_expected INTEGER;
  v_converted_at TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL
     OR p_gift_id IS NULL
     OR p_coins IS NULL
     OR p_coins <= 0 THEN
    RAISE EXCEPTION 'Invalid gift conversion request'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_gift
    FROM public.gifts
   WHERE id::TEXT = p_gift_id
     AND recipient_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_value := COALESCE(v_gift.gift_value, '{}'::jsonb);

  IF v_gift.status <> 'claimed' THEN
    RAISE EXCEPTION 'Accept this gift before converting it'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE((v_value->>'delivery_pending')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'This gift has not been delivered yet'
      USING ERRCODE = '22023';
  END IF;

  v_expected := COALESCE(NULLIF(v_value->>'coin_conversion', '')::INTEGER, 0);
  IF v_expected <= 0 THEN
    RAISE EXCEPTION 'This gift has no coin conversion value'
      USING ERRCODE = '22023';
  END IF;

  IF p_coins <> v_expected THEN
    RAISE EXCEPTION 'Gift conversion value does not match'
      USING ERRCODE = '22023';
  END IF;

  v_converted_at := NULLIF(v_value->>'converted_at', '')::TIMESTAMPTZ;

  SELECT * INTO v_profile
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Retry-safe: the first request marks the gift and credits the balance in
  -- the same transaction. Later requests return the recorded result.
  IF v_converted_at IS NOT NULL THEN
    RETURN JSONB_BUILD_OBJECT(
      'loop_coins', COALESCE(v_profile.loop_coins, 0),
      'converted_coins', COALESCE(NULLIF(v_value->>'converted_coins', '')::INTEGER, v_expected),
      'already_converted', TRUE
    );
  END IF;

  UPDATE public.profiles
     SET loop_coins = COALESCE(loop_coins, 0) + v_expected,
         updated_at = NOW()
   WHERE id = p_user_id
   RETURNING * INTO v_profile;

  INSERT INTO public.coin_transactions (
    user_id, amount, transaction_type, description
  ) VALUES (
    p_user_id,
    v_expected,
    'gift_conversion',
    'Converted ' || COALESCE(v_gift.gift_name, 'a gift') || ' to Loop Coins'
  );

  UPDATE public.gifts
     SET gift_value = v_value || JSONB_BUILD_OBJECT(
       'converted_at', NOW(),
       'converted_coins', v_expected
     )
   WHERE id::TEXT = p_gift_id;

  -- Keep the collection row for audit/history, but it is no longer an active
  -- benefit and cannot be converted again.
  UPDATE public.user_inventory
     SET is_active = FALSE,
         item_data = COALESCE(item_data, '{}'::jsonb) || JSONB_BUILD_OBJECT(
           'gift_converted_at', NOW()
         )
   WHERE user_id = p_user_id
     AND gift_id::TEXT = p_gift_id::TEXT;

  RETURN JSONB_BUILD_OBJECT(
    'loop_coins', COALESCE(v_profile.loop_coins, 0),
    'converted_coins', v_expected,
    'already_converted', FALSE
  );
END;
$convert_gift_to_coins$;

REVOKE ALL ON FUNCTION public.convert_gift_to_coins(UUID, TEXT, INTEGER) FROM PUBLIC;

DO $gift_conversion_acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.convert_gift_to_coins(UUID, TEXT, INTEGER) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.convert_gift_to_coins(UUID, TEXT, INTEGER) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.convert_gift_to_coins(UUID, TEXT, INTEGER) TO service_role;
  END IF;
END
$gift_conversion_acl$;

-- Make the new RPC visible to PostgREST without waiting for its next reload.
NOTIFY pgrst, 'reload schema';
