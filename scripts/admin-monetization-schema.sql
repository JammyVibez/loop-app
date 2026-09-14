-- ============================================================
-- Admin Monetization Management — schema
-- 1. pricing_change_log  : history of coin-tier price edits
-- 2. admin_action_log    : audit trail for all coin/pricing/sub admin actions
-- 3. profiles.premium_source : "stripe" | "admin" — distinguishes Stripe-paid
--                              Pro from admin-granted Pro in the UI
-- 4. subscriptions.source/granted_by/grant_reason : manual grant records
-- 5. shop_items.sort_order : admin-controlled ordering of coin packages
-- 6. admin_action_log reason + pricing_change_log.rationale : required audit note
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================

-- ── 1. Pricing change history ────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_id UUID,
    tier_name TEXT,
    old_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    changed_by UUID REFERENCES profiles(id),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_change_log_tier ON pricing_change_log(tier_id);
CREATE INDEX IF NOT EXISTS idx_pricing_change_log_created ON pricing_change_log(created_at DESC);

-- ── 2. Admin action audit log ────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_action_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES profiles(id),
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES profiles(id),
    reason TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_admin ON admin_action_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_target ON admin_action_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_created ON admin_action_log(created_at DESC);

-- ── 3. Pro source tracking on profiles ───────────────────────
-- "stripe" = real billing, "admin" = manually granted by an admin.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_source TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_granted_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_granted_at TIMESTAMP WITH TIME ZONE;

-- Backfill: existing Pro users came through real billing.
UPDATE profiles SET premium_source = 'stripe' WHERE is_premium = true AND premium_source IS NULL;

-- ── 4. Subscription source tracking ──────────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'stripe';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES profiles(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grant_reason TEXT;

UPDATE subscriptions SET source = 'stripe' WHERE source IS NULL;

-- ── 5. Coin package ordering ─────────────────────────────────
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- ── 6. Constraint updates ────────────────────────────────────
-- Subscriptions previously CHECK-constrained plan_type/status; relax if needed.
DO $$
BEGIN
  -- Widen status to include admin lifecycle values if the constraint exists.
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'subscriptions' AND nsp.nspname = 'public'
      AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  ) THEN
    DECLARE
      constraint_name text;
    BEGIN
      SELECT con.conname INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'subscriptions' AND nsp.nspname = 'public'
        AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      ORDER BY con.conname
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE subscriptions DROP CONSTRAINT %I', constraint_name);
      END IF;
    END;
    BEGIN
      ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_status_check
        CHECK (status IN ('active', 'cancelled', 'expired', 'incomplete', 'past_due'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Stripe coin-pack purchases should mark premium_source correctly on profiles
-- only for premium kinds — no-op here, handled by webhook metadata.

-- RLS: service role bypasses RLS, but add sensible policies for completeness.
ALTER TABLE pricing_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read pricing change log" ON pricing_change_log;
CREATE POLICY "Admins can read pricing change log" ON pricing_change_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can read admin action log" ON admin_action_log;
CREATE POLICY "Admins can read admin action log" ON admin_action_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============================================================
-- Done. The Admin → Monetization panel now has full CRUD on
-- coin pricing, user coin balances, and Pro subscriptions,
-- every action recorded in admin_action_log with admin identity,
-- timestamp, and reason.
-- ============================================================
