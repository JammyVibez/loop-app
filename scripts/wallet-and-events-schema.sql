-- Wallet & Events Schema Alignment Migration for Supabase

-- 1. Profiles (Ensure loop_coins exists)
-- NOTE: public.profiles is owned by scripts/complete-database-setup.sql, which
-- already runs before this file in scripts/run-production-setup.mjs and seeds
-- loop_coins via the app's economy defaults (see lib/economy.ts). This
-- CREATE TABLE is only a safety net for environments that run this file in
-- isolation, so its default must match the real signup bonus (not a fake
-- "everyone starts rich" balance).
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    loop_coins BIGINT DEFAULT 50,
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='loop_coins') THEN
        ALTER TABLE public.profiles ADD COLUMN loop_coins BIGINT DEFAULT 50;
    END IF;
END $$;

-- 2. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount_usd NUMERIC(10, 2) DEFAULT 0,
    coins_amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'completed',
    payment_method TEXT DEFAULT 'card',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON public.wallet_transactions(created_at DESC);

-- 3. Coin Gifts Table
CREATE TABLE IF NOT EXISTS public.coin_gifts (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_username TEXT,
    sender_name TEXT,
    sender_avatar TEXT,
    receiver_id TEXT NOT NULL,
    receiver_username TEXT,
    coins_amount INTEGER NOT NULL,
    gift_name TEXT,
    gift_icon TEXT,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_gifts_sender ON public.coin_gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_coin_gifts_receiver ON public.coin_gifts(receiver_id);

-- 4. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    host_id TEXT NOT NULL,
    host_name TEXT,
    host_avatar TEXT,
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'upcoming',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    cover_image TEXT,
    participants_count INTEGER DEFAULT 1,
    is_live BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_host ON public.events(host_id);

-- 5. Event Participants Table
CREATE TABLE IF NOT EXISTS public.event_participants (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'attendee',
    status TEXT DEFAULT 'joined',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_event_user UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_part_event ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_part_user ON public.event_participants(user_id);

-- 6. User Inventory Table
CREATE TABLE IF NOT EXISTS public.user_inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_type TEXT NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON public.user_inventory(user_id);

-- 7. Withdrawal Requests Table (real, manually admin-reviewed payout requests)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT,
    coins_amount INTEGER NOT NULL,
    estimated_usd NUMERIC(10, 2) NOT NULL,
    payout_method TEXT DEFAULT 'bank',
    payout_details TEXT,
    status TEXT DEFAULT 'pending_review',
    admin_note TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawal_requests' AND column_name='admin_note') THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN admin_note TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawal_requests' AND column_name='reviewed_at') THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='withdrawal_requests' AND column_name='reviewed_by') THEN
        ALTER TABLE public.withdrawal_requests ADD COLUMN reviewed_by TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wdr_user ON public.withdrawal_requests(user_id);

-- Private wallet/account records must never inherit the old public CRUD policies.
-- Service-role API routes own writes; authenticated clients may only read the
-- rows that belong to them (or gifts involving them). Event listings/rosters
-- remain public, but clients cannot mutate them directly.
DO $wallet_policies$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'wallet_transactions',
         'coin_gifts',
         'events',
         'event_participants',
         'user_inventory',
         'withdrawal_requests'
       )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END;
$wallet_policies$;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_transactions_read_own
  ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY coin_gifts_read_involved
  ON public.coin_gifts
  FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = sender_id OR auth.uid()::TEXT = receiver_id);

CREATE POLICY events_read_public
  ON public.events
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY event_participants_read_public
  ON public.event_participants
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY user_inventory_read_own
  ON public.user_inventory
  FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY withdrawal_requests_read_own
  ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id);

REVOKE ALL ON TABLE public.wallet_transactions FROM PUBLIC;
REVOKE ALL ON TABLE public.coin_gifts FROM PUBLIC;
REVOKE ALL ON TABLE public.user_inventory FROM PUBLIC;
REVOKE ALL ON TABLE public.withdrawal_requests FROM PUBLIC;

DO $wallet_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.wallet_transactions FROM anon;
    REVOKE ALL ON TABLE public.coin_gifts FROM anon;
    REVOKE ALL ON TABLE public.user_inventory FROM anon;
    REVOKE ALL ON TABLE public.withdrawal_requests FROM anon;
    GRANT SELECT ON TABLE public.events, public.event_participants TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.wallet_transactions FROM authenticated;
    REVOKE ALL ON TABLE public.coin_gifts FROM authenticated;
    REVOKE ALL ON TABLE public.user_inventory FROM authenticated;
    REVOKE ALL ON TABLE public.withdrawal_requests FROM authenticated;
    GRANT SELECT ON TABLE public.wallet_transactions, public.coin_gifts,
      public.events, public.event_participants, public.user_inventory,
      public.withdrawal_requests TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wallet_transactions,
      public.coin_gifts, public.events, public.event_participants,
      public.user_inventory, public.withdrawal_requests TO service_role;
  END IF;
END
$wallet_grants$;

-- Enable Supabase Realtime for Tables
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE coin_gifts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE withdrawal_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
