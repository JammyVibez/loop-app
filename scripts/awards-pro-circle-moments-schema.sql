-- Awards + Moments + Pro-only Circle schema
-- ============================================
-- 1) Awards: admin-defined award badges granted to users (see /api/admin/awards,
--    /api/awards, and the profile trophy shelf).
CREATE TABLE IF NOT EXISTS awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL DEFAULT '🏆',
  color TEXT NOT NULL DEFAULT '#f59e0b',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id UUID NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  awarded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_awards_user ON user_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_awards_award ON user_awards(award_id);
CREATE INDEX IF NOT EXISTS idx_awards_active ON awards(is_active);

ALTER TABLE user_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_awards_select" ON user_awards;
CREATE POLICY "user_awards_select" ON user_awards
  FOR SELECT USING (true);

ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "awards_select" ON awards;
CREATE POLICY "awards_select" ON awards
  FOR SELECT USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_awards;
EXCEPTION WHEN duplicate_object OR unique_violation OR others THEN
  NULL;
END
$$;

-- 2) Moments: ephemeral 24-48h posts that auto-delete after expiry.
CREATE TABLE IF NOT EXISTS moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moments_user ON moments(user_id);
CREATE INDEX IF NOT EXISTS idx_moments_expires ON moments(expires_at);

ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moments_select" ON moments;
CREATE POLICY "moments_select" ON moments
  FOR SELECT USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE moments;
EXCEPTION WHEN duplicate_object OR unique_violation OR others THEN
  NULL;
END
$$;

-- 3) Pro-only circle: only Pro users can see it; Pro users are auto-added,
--    and automatically removed when their subscription lapses.
ALTER TABLE circles ADD COLUMN IF NOT EXISTS is_premium_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure a stable uniqueness target for the membership upsert below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.circle_members'::regclass
      AND contype = 'u'
      AND conname = 'circle_members_circle_id_user_id_key'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS circle_members_circle_user_unique
        ON public.circle_members(circle_id, user_id);
    EXCEPTION WHEN unique_violation THEN
      -- Existing duplicate rows: keep the newest membership per (circle, user).
      DELETE FROM public.circle_members a
      USING public.circle_members b
      WHERE a.circle_id = b.circle_id AND a.user_id = b.user_id
        AND a.joined_at < b.joined_at;
      CREATE UNIQUE INDEX IF NOT EXISTS circle_members_circle_user_unique
        ON public.circle_members(circle_id, user_id);
    END;
  END IF;
END
$$;

-- Trigger: keep Pro memberships in sync with subscription state.
CREATE OR REPLACE FUNCTION sync_pro_circle_membership() RETURNS trigger AS $$
DECLARE
  -- circles.id is UUID on a fresh setup and BIGINT on older databases.
  pro_circle_id public.circles.id%TYPE;
  is_pro BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.is_premium IS NOT DISTINCT FROM OLD.is_premium
     AND NEW.premium_expires_at IS NOT DISTINCT FROM OLD.premium_expires_at THEN
    RETURN NEW;
  END IF;

  SELECT id INTO pro_circle_id
  FROM circles
  WHERE is_premium_only = TRUE AND is_active = TRUE
  ORDER BY created_at ASC
  LIMIT 1;

  IF pro_circle_id IS NULL THEN
    RETURN NEW;
  END IF;

  is_pro := NEW.is_premium = TRUE
            AND (NEW.premium_expires_at IS NULL OR NEW.premium_expires_at > now());

  IF is_pro THEN
    INSERT INTO circle_members (circle_id, user_id, role, status, joined_at)
    VALUES (pro_circle_id, NEW.id, 'member', 'active', now())
    ON CONFLICT (circle_id, user_id) DO UPDATE
      SET status = 'active', role = 'member';
  ELSE
    DELETE FROM circle_members
    WHERE circle_id = pro_circle_id AND user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pro_circle_membership ON profiles;
CREATE TRIGGER trg_sync_pro_circle_membership
  AFTER INSERT OR UPDATE OF is_premium, premium_expires_at ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_pro_circle_membership();
