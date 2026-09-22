-- Admin + verification integrity fixes (2026-09)
-- Idempotent. Run via scripts/apply-pending-schema.mjs.

-- 1. security_audit_log: make sure it exists even if the 2FA script never ran.
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip_action_time ON security_audit_log(ip_address, action, created_at);

-- 2. admin_action_log (used by lib/admin-audit.ts)
CREATE TABLE IF NOT EXISTS admin_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_created ON admin_action_log(created_at DESC);

-- 3. wallet_transactions soft-delete column referenced by admin monetization UI.
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4. circles video avatar (used by search / pulse / home circle-activity).
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS video_avatar_url TEXT;

-- 5. notifications: aliases used across the app.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
CREATE OR REPLACE FUNCTION notifications_sync_read_trigger() RETURNS trigger AS $$
BEGIN
  NEW.read := COALESCE(NEW.is_read, FALSE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS notifications_sync_read ON public.notifications;
CREATE TRIGGER notifications_sync_read BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION notifications_sync_read_trigger();

-- 6. Verification requests: user-submitted, admin-reviewed.
-- The table already exists with an older shape; widen it so any combination
-- of submitted fields is acceptable and new statuses are allowed.
ALTER TABLE public.verification_requests ALTER COLUMN real_name DROP NOT NULL;
ALTER TABLE public.verification_requests ALTER COLUMN verification_type DROP NOT NULL;
ALTER TABLE public.verification_requests ALTER COLUMN username DROP NOT NULL;
ALTER TABLE public.verification_requests ALTER COLUMN reason DROP NOT NULL;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_requests_verification_type_check'
      AND conrelid = 'public.verification_requests'::regclass
  ) THEN
    ALTER TABLE public.verification_requests DROP CONSTRAINT verification_requests_verification_type_check;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_requests_status_check'
      AND conrelid = 'public.verification_requests'::regclass
  ) THEN
    ALTER TABLE public.verification_requests DROP CONSTRAINT verification_requests_status_check;
  END IF;
END $$;
ALTER TABLE public.verification_requests ADD CONSTRAINT verification_requests_status_check
  CHECK (status::text IN ('pending', 'approved', 'rejected', 'cancelled'));
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS additional_info TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_requests_one_pending
  ON verification_requests(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user ON verification_requests(user_id);
