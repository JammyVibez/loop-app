-- =============================================================
-- More coin packs + refund system
-- Adds smaller and larger Loop Coin tiers and the refund_requests
-- table that powers the self-service refund flow (Stripe purchases).
-- Safe to run multiple times.
-- =============================================================

-- ------------------------------------------------------------------
-- 1. Extra coin packs (Stripe Checkout, metadata kind: "coin_pack")
-- ------------------------------------------------------------------
-- Ensure 'coins' is a valid shop_category (enum safety, like the font /
-- card_effect migration).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_category') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'shop_category' AND e.enumlabel = 'coins'
    ) THEN
      ALTER TYPE shop_category ADD VALUE 'coins';
    END IF;
  END IF;
END $$;

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Mini Pack', '250 Loop Coins — a quick top-up', 0, 1.49, 'coins', 'currency', 'common', false, '{"coins_amount": 250, "bonus": 0}', '{"preview": "🪙"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Mini Pack');

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Quick Pack', '500 Loop Coins + 100 bonus', 0, 2.99, 'coins', 'currency', 'common', false, '{"coins_amount": 500, "bonus": 100}', '{"preview": "💰"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Quick Pack');

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Champion Pack', '25,000 Loop Coins + 10,000 bonus', 0, 79.99, 'coins', 'currency', 'epic', false, '{"coins_amount": 25000, "bonus": 10000}', '{"preview": "🏆"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Champion Pack');

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Legend Pack', '50,000 Loop Coins + 25,000 bonus', 0, 149.99, 'coins', 'currency', 'legendary', false, '{"coins_amount": 50000, "bonus": 25000}', '{"preview": "💠"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Legend Pack');

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Creator Pack', '100,000 Loop Coins + 60,000 bonus — for serious creators', 0, 249.99, 'coins', 'currency', 'legendary', false, '{"coins_amount": 100000, "bonus": 60000}', '{"preview": "👑"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Creator Pack');

-- ------------------------------------------------------------------
-- 2. wallet_transactions: track the Stripe PaymentIntent + item so the
--    refund flow can reverse the charge and (for shop items) remove the
--    granted inventory row.
-- ------------------------------------------------------------------
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_wallet_tx_payment_intent ON public.wallet_transactions(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_item ON public.wallet_transactions(item_id);

-- ------------------------------------------------------------------
-- 3. refund_requests — self-service refund requests backed by Stripe
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    wallet_tx_id TEXT NOT NULL,
    session_id TEXT,
    payment_intent_id TEXT,
    item_id TEXT,
    amount_usd NUMERIC(10, 2) DEFAULT 0,
    coins_amount INTEGER NOT NULL DEFAULT 0,
    tx_type TEXT NOT NULL DEFAULT 'deposit',
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user ON public.refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_wallet_tx ON public.refund_requests(wallet_tx_id);

-- FK so PostgREST can embed the ledger row in refund list queries
-- (both columns are TEXT). Idempotent guard for re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'refund_requests_wallet_tx_fk'
  ) THEN
    ALTER TABLE public.refund_requests
      ADD CONSTRAINT refund_requests_wallet_tx_fk
      FOREIGN KEY (wallet_tx_id) REFERENCES public.wallet_transactions(id);
  END IF;
END $$;

-- RLS: users can read + create their own refund requests; admins manage them
-- via the service role (API routes).
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refund_requests' AND policyname = 'refund_requests_select_own') THEN
    CREATE POLICY refund_requests_select_own ON public.refund_requests
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refund_requests' AND policyname = 'refund_requests_insert_own') THEN
    CREATE POLICY refund_requests_insert_own ON public.refund_requests
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 4. Realtime publication (live refund status updates on the wallet page)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'refund_requests'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_requests;
    END IF;
  END IF;
END $$;
