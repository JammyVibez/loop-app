-- ============================================================
-- 0. Migrate legacy quests table (bigint id, no cadence/type columns).
-- The legacy table is empty in this deployment; rename it out of the way
-- so the new catalog can be created cleanly. If it has rows, they're kept
-- in quests_legacy_backup and NOT auto-migrated (different schema).
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quests')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='quests' AND column_name='cadence'
     )
  THEN
    DECLARE
      legacy_rows integer;
    BEGIN
      SELECT count(*) INTO legacy_rows FROM quests;
      IF legacy_rows > 0 THEN
        -- Keep data instead of dropping it.
        EXECUTE 'ALTER TABLE quests RENAME TO quests_legacy_backup';
        -- Rename dependent sequences/constraints conflict-free by using a new table below.
      ELSE
        DROP TABLE quests CASCADE;
      END IF;
    END;
  END IF;
END $$;

-- ============================================================
-- Quests — rewarded engagement system
-- Quest types: ad | survey | minigame | native
-- Rewards: coins | xp | item (shop_items) — admin-configurable per quest
-- Windows: daily (24h reset), weekly (7d reset), seasonal (admin start/end)
-- All reward crediting is server-side; ad/survey rewards require the
-- network's signed server postback (HMAC verified in the callback route).
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================

-- ── 1. Quest catalog (admin-managed) ─────────────────────────
CREATE TABLE IF NOT EXISTS quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Content
    title VARCHAR(140) NOT NULL,
    description TEXT,
    icon VARCHAR(40) DEFAULT 'target',        -- lucide icon name
    accent VARCHAR(20) DEFAULT 'violet',      -- violet|amber|emerald|cyan|rose|sky

    -- Type + mechanics
    quest_type VARCHAR(20) NOT NULL DEFAULT 'native'
        CHECK (quest_type IN ('ad', 'survey', 'minigame', 'native')),
    minigame_kind VARCHAR(20) DEFAULT 'trivia',   -- trivia | reaction
    requirement_count INTEGER NOT NULL DEFAULT 1, -- e.g. 3 posts, 1 ad, 100 reaction score
    native_action VARCHAR(40),                    -- create_loop|create_comment|join_circle|win_duel|send_gift|daily_checkin

    -- Window: daily | weekly | seasonal
    cadence VARCHAR(20) NOT NULL DEFAULT 'daily'
        CHECK (cadence IN ('daily', 'weekly', 'seasonal')),
    starts_at TIMESTAMP WITH TIME ZONE,           -- seasonal only
    ends_at TIMESTAMP WITH TIME ZONE,             -- seasonal only

    -- Reward: admin-configurable combination
    reward_type VARCHAR(20) NOT NULL DEFAULT 'coins'
        CHECK (reward_type IN ('coins', 'xp', 'item', 'coins_xp')),
    reward_coins INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    reward_item_id BIGINT REFERENCES shop_items(id) ON DELETE SET NULL,  -- shop_items.id is bigint in this deployment
    reward_item_qty INTEGER DEFAULT 1,
    reward_label VARCHAR(120),                    -- display text, e.g. "500 coins + Cyberpunk theme"

    -- Visibility
    visibility VARCHAR(20) NOT NULL DEFAULT 'all'
        CHECK (visibility IN ('all', 'pro', 'organization', 'new_users')),
    min_level INTEGER DEFAULT 1,
    max_level INTEGER,                            -- NULL = no cap

    -- Anti-abuse
    max_completions_per_user INTEGER DEFAULT 1,   -- per window
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Meta
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quests_active ON quests(is_active, cadence, sort_order);
CREATE INDEX IF NOT EXISTS idx_quests_window ON quests(starts_at, ends_at);

-- ── 2. Per-user progress (one row per user per quest per window) ──
CREATE TABLE IF NOT EXISTS quest_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    progress_count INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    window_key TEXT NOT NULL,                 -- '2026-09-14' (daily) | '2026-W37' (weekly) | 'seasonal' (seasonal)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(quest_id, user_id, window_key)
);

CREATE INDEX IF NOT EXISTS idx_quest_progress_user ON quest_progress(user_id, window_key);
CREATE INDEX IF NOT EXISTS idx_quest_progress_quest ON quest_progress(quest_id, completed_at);

-- ── 3. Reward claim ledger (audit + analytics) ───────────────
CREATE TABLE IF NOT EXISTS quest_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    window_key TEXT NOT NULL,
    coins_awarded INTEGER DEFAULT 0,
    xp_awarded INTEGER DEFAULT 0,
    item_id BIGINT REFERENCES shop_items(id) ON DELETE SET NULL,
    item_qty INTEGER DEFAULT 0,
    source VARCHAR(20) NOT NULL DEFAULT 'user',   -- user | ad_postback | survey_postback | minigame | admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quest_claims_quest ON quest_claims(quest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quest_claims_user ON quest_claims(user_id, created_at DESC);

-- ── 4. Economy caps + 3P integration secrets (admin settings) ──
-- Stored in admin_settings: quest_daily_coin_cap, quest_daily_xp_cap,
-- ad_network_secret (HMAC for rewarded-ad postbacks),
-- survey_network_secret (HMAC for survey postbacks).
INSERT INTO admin_settings (setting_key, setting_value)
VALUES
  ('quest_daily_coin_cap', '{"value": 2000}'),
  ('quest_daily_xp_cap', '{"value": 500}')
ON CONFLICT (setting_key) DO NOTHING;

-- ── 5. Realtime (optional; live quest list refresh) ──────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE quests; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE quest_progress; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- ── 6. RLS (service role bypasses; add read policies for safety) ──
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active quests" ON quests;
CREATE POLICY "Anyone can read active quests" ON quests
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can read own quest progress" ON quest_progress;
CREATE POLICY "Users can read own quest progress" ON quest_progress
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own quest claims" ON quest_claims;
CREATE POLICY "Users can read own quest claims" ON quest_claims
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- Done. Admin → Quests panel manages the catalog; the user
-- /quests page renders progress with animated completion states.
-- ============================================================
