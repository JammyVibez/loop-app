-- Daily claims ledger, coin transaction types, cosmetics, leveling helpers
-- Safe to re-run (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS patterns)

-- 1) Reliable daily claim source of truth (mirrors weekly_bonus_claims)
CREATE TABLE IF NOT EXISTS daily_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'daily' CHECK (kind IN ('daily', 'weekly')),
  amount INTEGER NOT NULL DEFAULT 40,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_claims_user_kind_claimed
  ON daily_claims (user_id, kind, claimed_at DESC);

-- 2) Expand coin_transactions allowed types (constraint name may vary)
DO $$
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
    AND pg_get_constraintdef(con.oid) ILIKE '%transaction_type%';
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE coin_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE coin_transactions
    ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
      'purchase',
      'gift_sent',
      'gift_received',
      'quest_reward',
      'weekly_bonus',
      'daily_checkin',
      'onboarding_bonus',
      'admin_grant',
      'admin_reward',
      'premium_purchase',
      'refund',
      'level_reward',
      'earning_payout'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Cosmetics snapshot on profiles (badges / frames / auras)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_cosmetics JSONB DEFAULT '{}'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preferences JSONB DEFAULT '{}'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS available_earnings NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(12, 2) DEFAULT 0;

-- 4) Level from XP
CREATE OR REPLACE FUNCTION calculate_user_level(user_xp INTEGER)
RETURNS TABLE(level INTEGER, next_level_xp INTEGER) AS $$
DECLARE
  calculated_level INTEGER;
  next_xp INTEGER;
BEGIN
  calculated_level := GREATEST(1, FLOOR(SQRT(GREATEST(user_xp, 0) / 100.0))::INTEGER);
  next_xp := POWER(calculated_level + 1, 2) * 100;
  RETURN QUERY SELECT calculated_level, next_xp;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION award_user_xp(
  target_user_id UUID,
  xp_amount INTEGER,
  reason TEXT DEFAULT 'Activity reward'
)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN) AS $$
DECLARE
  current_xp INTEGER;
  old_level INTEGER;
  computed_xp INTEGER;
  computed_level INTEGER;
BEGIN
  SELECT COALESCE(xp_points, 0), COALESCE(level, 1)
    INTO current_xp, old_level
  FROM profiles WHERE id = target_user_id
  FOR UPDATE;

  computed_xp := current_xp + GREATEST(xp_amount, 0);
  SELECT cl.level INTO computed_level FROM calculate_user_level(computed_xp) cl;

  UPDATE profiles
  SET xp_points = computed_xp,
      level = computed_level,
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN QUERY SELECT computed_xp, computed_level, (computed_level > old_level);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_user_earnings(p_user_id UUID, amount DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET total_earnings = COALESCE(total_earnings, 0) + amount,
      available_earnings = COALESCE(available_earnings, 0) + amount,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;
